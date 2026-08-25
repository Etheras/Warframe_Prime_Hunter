/* Warframe Prime Hunter's model tests — no browser, no packages.
 *
 *     node --test tests/test_model.mjs
 *     python tests/test_build.py        # runs these too
 *
 * assets/model.js is the logic that used to sit inside click handlers and
 * render functions on both pages: what a relic opening is worth, which
 * refinement to take it to, which bucket an item is in, and how to read a
 * backup. Pulling it out was worth doing on its own — the two pages disagreed
 * about several of these — but the reason it is out is so this file can exist.
 *
 * These are the decisions a person acts on. The refinement advice tells you how
 * to spend a relic you cannot get back, and parseBackup decides how much of
 * your saved progress survives a restore. Neither had a single test before.
 *
 * node:test, node:assert and node:vm only, like tests/test_assets.mjs. This
 * file is the one that must stay meaningful when Playwright is not installed.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = (name) => fs.readFileSync(path.join(ROOT, "assets", name), "utf8");

/* model.js reads the squad odds from shared.js, so both are loaded into one
   context - which also checks they agree about that formula. shared.js touches
   a handful of browser globals on the way in, hence the stubs. */
function load() {
  const el = () => ({ style: {}, classList: { add() {}, toggle() {} }, dataset: {},
                      appendChild() {}, addEventListener() {}, hidden: false, className: "" });
  const store = new Map();
  const ctx = {
    window: { WFPRIME_DATA: {}, addEventListener() {} },
    document: { createElement: el, body: el(), addEventListener() {},
                querySelector: () => null },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    console: { info() {}, warn() {}, error() {} },
    Math, JSON, Object, Array, String, Number, Map, Set, Date, Infinity, isFinite,
    Error, TypeError,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(source("shared.js"), ctx);
  vm.runInContext(source("model.js"), ctx);
  return ctx.window.WFPrimeModel;
}

/* Cross-realm objects have this context's prototypes, so compare structure. */
const plain = (v) => JSON.parse(JSON.stringify(v));

/* A standard relic: three commons at 25.33, two uncommons at 11, one rare at 2,
   and the way each moves as the relic is refined. Real numbers from the
   dataset, because the whole point of the bottleneck rule is that it turns on
   where the curves cross. */
const COMMON = { Intact: 25.33, Exceptional: 23.33, Flawless: 20, Radiant: 16.67 };
const UNCOMMON = { Intact: 11, Exceptional: 13, Flawless: 17, Radiant: 20 };
const RARE = { Intact: 2, Exceptional: 4, Flawless: 6, Radiant: 10 };

const want = (chances, extra) => Object.assign({ chances, qty: 1, stillNeed: 1 }, extra);

// ── what a reward is ───────────────────────────────────────────────────────

test("rarity comes from the unrefined chance, not from DE's wording", () => {
  const M = load();
  assert.equal(M.rarityOf(COMMON), "Common");
  assert.equal(M.rarityOf(UNCOMMON), "Uncommon");
  assert.equal(M.rarityOf(RARE), "Rare");
  // the same rare at Radiant is still a rare, though its chance now reads 10%
  assert.equal(M.rarityOf({ Intact: 2, Radiant: 10 }), "Rare");
  assert.equal(M.rarityOf(null), "");
  assert.equal(M.rarityOf({}), "", "an unknown chance is not a rarity");
});

test("the per-part advice is one end or the other, never the middle", () => {
  const M = load();
  assert.equal(M.refineAdvice(RARE).label, "Radiant", "a rare only gets better");
  assert.equal(M.refineAdvice(COMMON).label, "Intact", "a common only gets worse");
  assert.equal(M.refineAdvice(null), null);
  assert.equal(M.refineAdvice({ Intact: 0, Radiant: 5 }), null, "no basis to advise on");
});

// ── which refinement, over everything wanted ───────────────────────────────

test("refinement follows the bottleneck, not the best overall hit rate", () => {
  const M = load();
  // wanting a common and a rare from one relic. Intact has the better total
  // (27.33% vs 26.67%) and is the wrong answer: it leaves the rare at 50
  // expected openings, where Radiant needs 10.
  const both = [want(COMMON), want(RARE)];
  const pick = M.bestRefinement(both, {});
  assert.equal(pick.refinement, "Radiant");
  assert.equal(Math.round(pick.openings), 10, "expected openings for the scarcest thing");

  const intactTotal = M.relicValue(both, "Intact", false);
  const radiantTotal = M.relicValue(both, "Radiant", false);
  assert.ok(intactTotal > radiantTotal,
            "Intact really does have the better total - that is why this is a trap");
});

test("the middle steps win when two wanted rewards cross there", () => {
  const M = load();
  // an uncommon and a common: the rising and falling curves meet at Flawless
  const pick = M.bestRefinement([want(UNCOMMON), want(COMMON)], {});
  assert.equal(pick.refinement, "Flawless",
               "the answer is not always one of the two ends once you want two things");
});

test("Forma counts towards the total but never sets the bottleneck", () => {
  const M = load();
  const withForma = [want(RARE), want(COMMON, { bonus: true, qty: 2, stillNeed: 4 })];
  const pick = M.bestRefinement(withForma, {});
  assert.equal(pick.blocker.chances, RARE, "you are not blocked on Forma");
  assert.equal(pick.refinement, "Radiant");
});

test("a drop of two is only worth double when two are wanted", () => {
  const M = load();
  const one = M.relicValue([want(COMMON, { qty: 2, stillNeed: 1 })], "Intact", false);
  const two = M.relicValue([want(COMMON, { qty: 2, stillNeed: 2 })], "Intact", false);
  assert.ok(Math.abs(two - one * 2) < 1e-9, "min(qty, stillNeed) is the whole rule");
});

test("a squad raises the odds without changing which refinement wins", () => {
  const M = load();
  const solo = M.relicValue([want(RARE)], "Radiant", false);
  const squad = M.relicValue([want(RARE)], "Radiant", true);
  assert.ok(Math.abs(solo - 0.10) < 1e-9);
  assert.ok(Math.abs(squad - (1 - Math.pow(0.9, 4))) < 1e-9, "best of four rolls");
  assert.equal(M.bestRefinement([want(RARE)], { squad: true }).refinement, "Radiant");
});

test("a refinement the relic has no chance for is skipped, not counted as zero", () => {
  const M = load();
  const partial = [want({ Intact: 25.33 })];
  assert.equal(M.relicValue(partial, "Radiant", false), 0);
  assert.equal(M.bestRefinement(partial, {}).refinement, "Intact");
});

// ── which bucket an item is in ─────────────────────────────────────────────

test("availability picks one bucket, in the order that matters", () => {
  const M = load();
  const of = (flags) => M.statusOf({ flags });
  assert.equal(of({ founder: true, farmable: true }), "founder", "never coming back wins");
  assert.equal(of({ resurgence: true, farmable: true }), "resurgence", "it has a deadline");
  assert.equal(of({ farmable: true, baro: true }), "farmable");
  // Gotva Prime is marked (S) on the wiki but is really a Baro item
  assert.equal(of({ baro: true, special: true }), "baro");
  assert.equal(of({ special: true }), "special");
  assert.equal(of({}), "vaulted");
  assert.equal(M.statusOf({}), "vaulted", "an item with no flags at all");
});

test("a filter reads every bucket an item is in, not just the one it shows as", () => {
  /* One bucket is right for the badge, the sort and the heading. It was wrong
     for the sidebar: filtering on the primary alone meant unticking *Farmable*
     also hid Lex Prime from the *Baro Ki'Teer* box that was still ticked, and
     nothing on screen said where it had gone. */
  const M = load();
  /* Joined rather than compared as arrays: the model runs in its own vm
     context, so its Array is not this file's and deepStrictEqual refuses two
     lists that hold the same strings. */
  const of = (flags) => M.bucketsOf({ flags }).join(" ");
  // Lex Prime: its relics still drop, and Baro sells it too
  assert.equal(of({ farmable: true, baro: true }), "farmable baro");
  // Gotva Prime: a Baro item that the wiki also marks (S)
  assert.equal(of({ baro: true, special: true }), "baro special");
  assert.equal(of({ farmable: true }), "farmable");
  assert.equal(of({ founder: true, farmable: true }), "founder farmable");

  /* Vaulted is the absence of a source rather than one of them, so it is never
     one of several - an item with a live source is not also vaulted here, even
     when DE's own vaulted flag is set. */
  assert.equal(of({}), "vaulted", "no flags at all");
  assert.equal(of({ vaulted: true, resurgence: true }), "resurgence");

  // and the one it displays as is the first of them, so the two cannot drift
  assert.equal(M.statusOf({ flags: { farmable: true, baro: true } }), "farmable");
  assert.equal(M.statusOf({ flags: { baro: true, special: true } }), "baro");
});

// ── reading a backup ───────────────────────────────────────────────────────

const CATALOGUE = [
  { id: "warframe-xaku-prime", name: "Xaku Prime",
    parts: [{ name: "Blueprint", itemCount: 1 }, { name: "Chassis", itemCount: 1 },
            { name: "Systems", itemCount: 2 }] },
  { id: "primary-braton-prime", name: "Braton Prime",
    parts: [{ name: "Blueprint", itemCount: 1 }, { name: "Barrel", itemCount: 1 }] },
  { id: "warframe-excalibur-prime", name: "Excalibur Prime", parts: [] },
];

test("a backup restores what it should and counts what it could not", () => {
  const M = load();
  const out = M.parseBackup(JSON.stringify({
    format: 3,
    collected: ["warframe-xaku-prime", "warframe-gone-prime"],
    parts: {
      "warframe-xaku-prime": { Chassis: 1, Systems: 2, Wings: 1 },
      "item-that-left": { Blueprint: 1 },
    },
    wishlist: ["primary-braton-prime", "also-gone"],
  }), CATALOGUE);

  assert.deepEqual(plain(out.collected), ["warframe-xaku-prime"]);
  assert.deepEqual(plain(out.parts), { "warframe-xaku-prime": { Chassis: 1, Systems: 2 } },
                   "a part the catalogue no longer has is dropped, not kept");
  assert.deepEqual(plain(out.wishlist), ["primary-braton-prime"]);
  assert.equal(out.skipped, 4, "one item, one part, one whole item, one wish");
});

test("a part count is clamped to what the part actually needs", () => {
  const M = load();
  const out = M.parseBackup(JSON.stringify({
    collected: [],
    parts: { "warframe-xaku-prime": { Systems: 99, Chassis: -3, Blueprint: 1 } },
  }), CATALOGUE);
  assert.deepEqual(plain(out.parts),
                   { "warframe-xaku-prime": { Systems: 2, Blueprint: 1 } },
                   "99 clamps to the 2 it needs; a negative count is dropped entirely");
});

test("an old bare-array backup means 'these are complete'", () => {
  const M = load();
  const out = M.parseBackup(JSON.stringify(
    ["warframe-xaku-prime", "warframe-excalibur-prime"]), CATALOGUE);
  assert.equal(out.legacy, true);
  assert.deepEqual(plain(out.parts),
                   { "warframe-xaku-prime": { Blueprint: 1, Chassis: 1, Systems: 2 } },
                   "parts are filled in from the catalogue, at the count each needs");
  assert.ok(!("warframe-excalibur-prime" in out.parts),
            "an item with no parts stays a plain tick");
});

test("only the planner options we recognise come back", () => {
  const M = load();
  /* `runMode` is in this file on purpose: it was a real option until
     2026-08-24, so backups in the wild carry it, and an option that stopped
     existing has to be dropped rather than restored into a setting nothing
     reads. Same path as `somethingElse` — not named, not kept. */
  const out = M.parseBackup(JSON.stringify({
    collected: [],
    plan: { squad: true, aya: false, formaNeed: 3, runMode: "aabcaa",
            minutes: { Defense: 2, Spy: 4.5 },
            somethingElse: "ignored", __proto__: "nope" },
  }), CATALOGUE);
  assert.deepEqual(plain(out.plan),
                   { squad: true, aya: false, formaNeed: 3,
                     minutes: { Defense: 2, Spy: 4.5 } },
                   "both pages' options survive, and nothing else does");
});

test("the effort weights are carried by a backup, since they are typed by hand", () => {
  /* Twenty numbers a player measured themselves are the most expensive thing in
     the store to lose and the only thing here that cannot be recovered from the
     game. Dropping them silently is the failure worth guarding against - the
     dialog promises "planner options" and this is one. */
  const M = load();
  const out = M.parseBackup({ collected: [], plan: { minutes: { Survival: 12 } } },
                            CATALOGUE);
  assert.deepEqual(plain(out.plan), { minutes: { Survival: 12 } });
});

test("materials are cleaned up rather than trusted", () => {
  const M = load();
  const out = M.parseBackup(JSON.stringify({
    collected: [],
    materials: [{ name: "Forma", have: "4", need: 2 },
                { name: "x".repeat(200), have: -5, need: "abc" },
                "not an object", null],
  }), CATALOGUE);
  assert.equal(out.materials.length, 2, "the junk entries are dropped");
  assert.deepEqual(plain(out.materials[0]), { name: "Forma", have: 4, need: 2 },
                   "a numeric string is a number");
  assert.equal(out.materials[1].name.length, 60, "a runaway name is truncated");
  assert.deepEqual(plain(out.materials[1]), { name: "x".repeat(60), have: 0, need: 0 });
});

test("absent sections come back as null, not as empty ones", () => {
  const M = load();
  const out = M.parseBackup(JSON.stringify({ collected: [] }), CATALOGUE);
  assert.equal(out.wishlist, null, "null means 'the backup did not carry this'");
  assert.equal(out.materials, null, "an empty array would wipe what you have");
  assert.equal(out.plan, null);
  assert.equal(out.filters, null);
});

test("something that is not a backup is refused, and says so", () => {
  const M = load();
  for (const bad of ['{"hello":"world"}', "null", '"a string"', "42",
                     '{"collected":"not an array"}']) {
    assert.throws(() => M.parseBackup(bad, CATALOGUE),
                  /doesn't look like a Prime Hunter backup/, `accepted ${bad}`);
  }
  assert.throws(() => M.parseBackup("{not json", CATALOGUE), SyntaxError);
});

test("an already-parsed object is accepted, so callers need not stringify", () => {
  const M = load();
  const out = M.parseBackup({ collected: ["warframe-xaku-prime"] }, CATALOGUE);
  assert.deepEqual(plain(out.collected), ["warframe-xaku-prime"]);
});

/* ── what a Void Trace is worth ───────────────────────────────────────────
 * traceValue answers the one question the ranking cannot see for itself: given
 * the player says they are short of traces, what is one worth? It is the rate
 * at which a marginal trace buys refinement uplift, taken at the best place in
 * the plan to spend it. Subjects here are hand-built plans with stated numbers
 * rather than anything read back out of the model, so the arithmetic is checked
 * against figures written down in the test.
 */

/* ── a relic handed over already Radiant ─────────────────────────────────
 * Two attempts to price this collapsed to zero on the live data and neither had
 * a test that could catch it, because both were exercised only through the page.
 * sourceValue lives in model.js now so the arithmetic is checked here. Subjects
 * are hand-built plans with stated numbers, never anything read back out of the
 * model.
 */

test("a Radiant source is flagged for the bonus while traces are tight", () => {
  const M = load();
  const rp = { value: 0.40, refinement: "Radiant",
               byRefinement: { Intact: 0.30, Radiant: 0.40 } };

  const tight = M.sourceValue({ refinement: "Radiant" }, rp, { traces: true });
  assert.equal(tight.bonus, true);
  assert.equal(tight.pre, true);
  /* The value stays the honest one. The uplift is NOT applied here: the ranked
     number is a count taken from the drop chances and never sees `value`, so a
     multiplier at this point moves the tooltip and leaves the ORDER alone --
     measured at +0.0% on all eleven nodes before it was moved. plan.js applies
     `radiantMultiplier` to the score and the rate, where CACHE_PENALTY goes. */
  assert.equal(tight.value, 0.40, "sourceValue reports the bonus, it does not apply it");

  const loose = M.sourceValue({ refinement: "Radiant" }, rp, { traces: false });
  assert.equal(loose.bonus, false, "no bonus when traces are not a constraint");
  assert.equal(loose.value, 0.40);

  assert.equal(M.RADIANT_BONUS, 0.25, "the judgement is one named constant");
});

test("the multiplier is weighted by how much of the node arrives Radiant", () => {
  const M = load();
  assert.equal(M.radiantMultiplier(1), 1.25, "a wholly pre-refined node -- all eleven are");
  assert.equal(M.radiantMultiplier(0), 1, "an ordinary node is untouched");
  assert.equal(M.radiantMultiplier(0.5), 1.125,
               "half pre-refined earns half the bonus, not all of it");
  // a share outside 0..1 must not become a wild multiplier
  assert.equal(M.radiantMultiplier(2), 1.25);
  assert.equal(M.radiantMultiplier(-1), 1);
  assert.equal(M.radiantMultiplier(null), 1);
  assert.equal(M.radiantMultiplier(undefined), 1);
});

test("the bonus cannot collapse to zero the way both previous attempts did", () => {
  /* They added a term derived from `cost(given) - cost(chosen)`. Every
     pre-refined node gives Radiant and bestRefinement picks Radiant for every
     live relic, so the term was 100 - 100 = 0 and the bonus never existed. A
     multiplier on the ranked figure cannot do that -- it does not depend on the
     plan's chosen refinement at all, which is the point of the shape. */
  const M = load();
  for (const chosen of ["Intact", "Exceptional", "Flawless", "Radiant"]) {
    const rp = { value: 0.4, refinement: chosen,
                 byRefinement: { Intact: 0.3, Exceptional: 0.34,
                                 Flawless: 0.37, Radiant: 0.4 } };
    const w = M.sourceValue({ refinement: "Radiant" }, rp, { traces: true });
    assert.equal(w.bonus, true,
                 `a Radiant source stopped earning it when the plan chose ${chosen}`);
  }
  assert.ok(M.radiantMultiplier(1) > 1, "and the multiplier is never 1x");
});

test("an ordinary source is untouched, whatever the traces setting", () => {
  const M = load();
  const rp = { value: 0.40, refinement: "Radiant",
               byRefinement: { Intact: 0.30, Radiant: 0.40 } };
  for (const traces of [true, false]) {
    const out = M.sourceValue({ planet: "Earth", node: "Cambria" }, rp, { traces });
    assert.equal(out.value, 0.40);
    assert.equal(out.pre, false);
    assert.equal(out.traces, 0);
  }
});

test("only Radiant earns the bonus, and a worse refinement still scores honestly", () => {
  const M = load();
  // wanted Radiant, given Exceptional: worth what you were actually handed
  const rp = { value: 0.40, refinement: "Radiant",
               byRefinement: { Intact: 0.30, Exceptional: 0.34, Radiant: 0.40 } };
  const given = M.sourceValue({ refinement: "Exceptional" }, rp, { traces: true });
  assert.equal(given.value, 0.34, "worth what you were actually handed");
  assert.equal(given.bonus, false, "no bonus below Radiant");

  /* Wanted Intact, given Radiant: still flagged, but what the multiplier acts on
     is the LOWER value, because refinement moved the common you were chasing
     away from you. 0.20 x 1.25 is 0.25, still well short of the 0.50 you wanted
     -- so the bonus cannot turn a worse relic into a better one. */
  const wantsCommon = { value: 0.50, refinement: "Intact",
                        byRefinement: { Intact: 0.50, Radiant: 0.20 } };
  const over = M.sourceValue({ refinement: "Radiant" }, wantsCommon, { traces: true });
  assert.equal(over.value, 0.20);
  assert.ok(over.value * M.radiantMultiplier(1) < wantsCommon.value,
            "a bonus on a worse relic must not make it better than what you wanted");
});

test("traces saved is the bill the node picks up, not the amount it overshoots", () => {
  /* This is why the row's "saving N Void Traces" clause had never printed: it
     was max(0, given - chosen), which is 0 whenever they match, which is always
     on the live data. */
  const M = load();
  const wantsRadiant = { value: 0.4, refinement: "Radiant",
                         byRefinement: { Intact: 0.3, Radiant: 0.4 } };
  assert.equal(M.sourceValue({ refinement: "Radiant" }, wantsRadiant, {}).traces, 100,
               "given exactly what the plan wanted still saves the whole bill");

  const wantsIntact = { value: 0.5, refinement: "Intact",
                        byRefinement: { Intact: 0.5, Radiant: 0.2 } };
  assert.equal(M.sourceValue({ refinement: "Radiant" }, wantsIntact, {}).traces, 0,
               "a plan spending nothing has no bill to pick up");

  const wantsRadiantGivenLess = { value: 0.4, refinement: "Radiant",
                                  byRefinement: { Exceptional: 0.34, Radiant: 0.4 } };
  assert.equal(M.sourceValue({ refinement: "Exceptional" }, wantsRadiantGivenLess, {}).traces,
               25, "capped at what you were given - you still top the rest up");
});

test("sourceValue survives being handed nothing", () => {
  const M = load();
  assert.equal(M.sourceValue(null, null, null).value, 0);
  assert.equal(M.sourceValue({ refinement: "Radiant" }, { value: 0.3 }, {}).value, 0.3,
               "a plan entry with no byRefinement map falls back to its own value");
});

test("the traces option survives a backup round trip", () => {
  const M = load();
  assert.ok(M.PLAN_OPTIONS.includes("traces"),
            "an option missing from PLAN_OPTIONS is silently dropped on restore");
  const out = M.parseBackup({ collected: [], plan: { traces: true, squad: false } },
                            CATALOGUE);
  assert.equal(out.plan.traces, true);
});
