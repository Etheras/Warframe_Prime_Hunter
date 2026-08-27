/* Warframe Prime Hunter's browser-side tests.
 *
 *     node --test tests/
 *     python tests/test_build.py        # runs these too, if node is installed
 *
 * The Python suite covers the pipeline; nothing covered the JavaScript, which
 * is where the rotation model actually lives. Every bug this file guards
 * against is one that happened and was caught by hand in a browser.
 *
 * Standard library only, like the rest of the project: node:test, node:assert
 * and node:vm. No package.json, no node_modules, nothing to install. The site
 * itself still needs no Node at all - it opens from file:// as it always did.
 *
 * The two shared modules are plain IIFEs that hang an object off `window`, so
 * they run in a vm context with a stub for the handful of browser globals they
 * touch. app.js and plan.js are not covered here: they are DOM from top to
 * bottom and would need a real DOM implementation, which would mean a
 * dependency. They are syntax-checked, and verified in a browser by hand.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = (name) => fs.readFileSync(path.join(ROOT, "assets", name), "utf8");

/* A window with just enough in it. `now` freezes the clock: the bounty clock
   is arithmetic on Date.now(), and a test that depended on the real one would
   pass or fail according to the time of day. */
function sandbox({ data = {}, now = Date.parse("2026-08-11T21:00:00Z"), seed = null,
                   fetch = null, timers = null } = {}) {
  const FixedDate = class extends Date {
    static now() { return now; }
  };
  const el = () => ({
    style: {}, classList: { add() {}, toggle() {} }, dataset: {},
    appendChild() {}, addEventListener() {}, hidden: false, className: "",
  });
  // `seed` puts something in the store *before* the module runs, which is the
  // only way to test a migration that happens on load
  const store = new Map(Object.entries(seed || {}));
  const ctx = {
    window: { WFPRIME_DATA: data, addEventListener() {} },
    document: {
      createElement: el, body: el(), addEventListener() {},
      querySelector: () => null,
    },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    console: { info() {}, warn() {}, error() {} },   // the coverage log is noise here
    Date: FixedDate,
    Math, JSON, Object, Array, String, Number, Map, Set, isFinite, parseInt,
  };
  /* Only for the fissure watcher, and only when a test asks. `setInterval` is
     recorded rather than run - a repeating timer inside a vm context outlives
     the test that made it - and its absence is what tells that test whether a
     second poller was started. */
  if (fetch) ctx.fetch = fetch;
  if (timers) {
    ctx.setInterval = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
    ctx.Promise = Promise;
  }
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  return ctx;
}

/* Objects made inside the vm have that context's prototypes, so strict
   deep-equality rejects them however identical they look. Compare structure. */
const plain = (v) => JSON.parse(JSON.stringify(v));

const loadRotation = (opts) => {
  const ctx = sandbox(opts);
  vm.runInContext(source("rotation.js"), ctx);
  return ctx.window.WFPrimeRotation;
};
const loadShared = (opts) => {
  const ctx = sandbox(opts);
  vm.runInContext(source("shared.js"), ctx);
  return { S: ctx.window.WFPrimeShared, ctx };
};

test("a count that is not a count is refused, whichever end it came from", () => {
  const { S } = loadShared();

  /* Both ends of this are documented as numeric and neither is obliged to be:
     the payload is built from a third-party items API, and localStorage is
     hand-editable and is written from a file the reader chose to import. Both
     reach innerHTML as `${have}/${need}`, beside an esc()'d name. */
  const hostile = ['<img src=x onerror=alert(1)>', "abc", "", null, undefined,
                   {}, [], NaN, Infinity, -1, 1.5, true, false];
  assert.deepEqual(hostile.filter((v) => S.count(v, 7) !== 7), [],
    "anything that is not a whole count must fall back, not render");

  assert.equal(S.count(0, 7), 0, "a real zero is a count and must survive");
  assert.equal(S.count("2", 7), 2, "an older backup can hold a numeric string");
  assert.equal(S.count(3, 7), 3);
});

test("a part count out of storage cannot become markup", () => {
  /* The realistic hostile input here is not an attacker but a backup someone
     hand-edited to fix a count. `seed` puts it in the store before the module
     runs, which is how it would actually arrive. */
  const payload = { "warframe-ash-prime": {
    Blueprint: '<img src=x onerror=alert(1)>',
    Chassis: "2",
    Neuroptics: -4,
  } };
  const { S } = loadShared({
    seed: { "wfprimes.parts.v1": JSON.stringify(payload) },
  });
  const ST = S.state;

  assert.equal(ST.owns("warframe-ash-prime", "Blueprint"), 0,
    "owns() lands in innerHTML as `${have}/${need}` and must never be a string");
  assert.equal(ST.owns("warframe-ash-prime", "Chassis"), 2,
    "an older backup holding \"2\" still means two");
  assert.equal(ST.owns("warframe-ash-prime", "Neuroptics"), 0,
    "a negative count is not a count");
  assert.equal(ST.owns("nobody-at-all", "Blueprint"), 0);

  assert.equal(S.count({ toString: () => "9" }, 1), 1,
    "an object that stringifies to a number is still not a number");
});

test("a store saved under the old name is carried across, not stranded", () => {
  /* The project was renamed from VorFrame on 2026-08-14 and the six storage
     keys moved with it. Everything else in that rename was cosmetic; this was
     not. Behind those keys is a hand-ticked collection that cannot be recovered
     from anywhere - not from the game, not from DE, not from a rebuild - so a
     migration that half works loses the only thing here that is genuinely the
     player's. */
  const legacy = {
    "vorframe.collected.v1": JSON.stringify(["warframe-nyx-prime"]),
    "vorframe.parts.v1": JSON.stringify({ "warframe-gyre-prime": { Chassis: 1 } }),
    "vorframe.materials.v1": JSON.stringify([{ name: "Forma", have: 3, need: 9 }]),
    "vorframe.wishlist.v1": JSON.stringify(["warframe-caliban-prime"]),
    "vorframe.plan.v1": JSON.stringify({ squad: true, minutes: { Defense: 2.5 } }),
    "vorframe.filters.v1": JSON.stringify({ sort: "name" }),
  };
  const { S, ctx } = loadShared({ seed: legacy });

  Object.keys(S.KEYS).forEach((name) => {
    const key = S.KEYS[name];
    assert.match(key, /^wfprimes\./, `${name} still carries the old prefix`);
    assert.deepEqual(plain(S.load(key, null)),
                     JSON.parse(legacy["vorframe." + name + ".v1"]),
                     `${name} did not survive the rename`);
  });

  // copied, not moved: a build that turns out to be broken must not have taken
  // the only copy of the data with it
  assert.equal(ctx.localStorage.getItem("vorframe.collected.v1"),
               legacy["vorframe.collected.v1"],
               "the old key was destroyed - there is no way back from that");

  // and anything already saved under the new name wins over the old
  const both = Object.assign({}, legacy,
    { "wfprimes.collected.v1": JSON.stringify(["warframe-mag-prime"]) });
  const fresh = loadShared({ seed: both });
  assert.deepEqual(plain(fresh.S.load(fresh.S.KEYS.collected, null)),
                   ["warframe-mag-prime"],
                   "a stale legacy key overwrote current data");
});

test("the Void Trace cap is the wiki's formula, and matches its worked examples", () => {
  /* `wiki.warframe.com/w/Void_Traces`: "This cap is determined by one's Mastery
     Rank using the formula: (Mastery Rank x 50) + 100." The two figures below
     are the page's OWN worked examples, which is what makes them worth
     asserting - they are an external check on the formula rather than a
     restatement of the line above it. */
  const { S } = loadShared();
  assert.equal(S.traceCap(13), 750, "the wiki works MR13 to 750");
  assert.equal(S.traceCap(30), 1600, "and MR30 to 1600");
  assert.equal(S.traceCap(0), 100, "Unranked still holds a hundred");
  assert.equal(S.traceCap(null), null, "an unset rank has no cap, rather than 100");

  /* A Radiant is 100 traces and the planner's switch splits at five of them.
     MR8 caps at exactly 500, so "over 500" first becomes reachable at MR9 -
     the boundary is the whole point of the note the planner prints. */
  assert.equal(S.traceCap(8), S.TRACE_PIVOT, "MR8 caps at exactly the pivot");
  assert.equal(S.traceCapped(8), true, "so it cannot get past it");
  assert.equal(S.traceCapped(9), false, "and MR9 is the first rank that can");
  assert.equal(S.traceCapped(null), false, "an unset rank claims nothing either way");
});

test("a rank renders as DE writes it, titles and Legendary included", () => {
  /* The titles and the three-rank base/Silver/Gold cycle are DE's, from
     `wiki.warframe.com/w/Mastery_Rank`. Named ranks rather than computed ones:
     picking the subject with the same arithmetic the code uses would assert
     nothing (PROJECT.md section 2). */
  const { S } = loadShared();

  assert.equal(S.masteryLabel(null), "—", "unset says so rather than guessing zero");
  assert.equal(S.masteryLabel(0), "MR 0");
  assert.equal(S.masteryLabel(30), "MR 30", "30 is the last numbered rank");
  assert.equal(S.masteryLabel(31), "LR 1", "and 31 is Legendary 1, not MR 31");
  assert.equal(S.masteryLabel(35), "LR 5");

  assert.equal(S.masteryTitle(0), "Unranked");
  assert.equal(S.masteryTitle(1), "Initiate");
  assert.equal(S.masteryTitle(2), "Silver Initiate");
  assert.equal(S.masteryTitle(3), "Gold Initiate");
  assert.equal(S.masteryTitle(4), "Novice", "the cycle restarts on a new base word");
  assert.equal(S.masteryTitle(12), "Gold Seeker");
  assert.equal(S.masteryTitle(13), "Hunter");
  assert.equal(S.masteryTitle(30), "Gold Architect", "the last one the wiki publishes");
  assert.equal(S.masteryTitle(31), "Legendary",
               "past 30 the wiki stops naming them, so neither do we");
  assert.equal(S.masteryTitle(null), null);

});

test("the box holds the number and the label holds the letters", () => {
  /* The letters sit outside the field because they are not part of the value:
     past 30 they become LR and the box holds the Legendary number, not the
     stored rank. These two functions are the split, and they have to round-trip
     or typing a rank back in would land somewhere else. */
  const { S } = loadShared();

  assert.equal(S.masteryShown(null), "", "unset shows nothing, not a zero");
  assert.equal(S.masteryShown(0), "0");
  assert.equal(S.masteryShown(30), "30", "the last rank the box shows as itself");
  assert.equal(S.masteryShown(31), "1", "LR 1 is stored as 31 and shown as 1");
  assert.equal(S.masteryShown(35), "5");

  /* In MR mode the typed number IS the rank, so 31 rolls over to Legendary on
     its own — which is the only way into LR from the keyboard. In LR mode it is
     offset by 30. */
  assert.equal(S.masteryTyped("13", false), 13);
  assert.equal(S.masteryTyped("31", false), 31, "typing past 30 rolls into Legendary");
  assert.equal(S.masteryTyped("1", true), 31, "LR 1 is rank 31");
  assert.equal(S.masteryTyped("0", true), 30, "and LR 0 is really MR 30");

  for (const mr of [0, 7, 30, 31, 42]) {
    const legendary = mr > S.MR_TOP;
    assert.equal(S.masteryTyped(S.masteryShown(mr), legendary), mr,
                 `${mr} did not survive being shown and typed back`);
  }

  /* Cleared and rejected are different answers and the caller treats them
     differently — one is written, the other is refused. */
  assert.equal(S.masteryTyped("", false), null, "an emptied box clears the rank");
  assert.equal(S.masteryTyped("   ", false), null);
  assert.equal(S.masteryTyped("abc", false), undefined, "letters are refused, not stored");
  assert.equal(S.masteryTyped("-4", false), undefined, "and so is a negative rank");
  assert.equal(S.masteryTyped("7.5", false), undefined, "and a fractional one");
});

/* One standard bounty on all three rotations, one publishing only two, one with
   a single table, and a vault family a step out of phase - which is what the
   live worldstate actually looks like. */
const BOUNTY_DATA = {
  meta: {
    bounties: {
      cycleMinutes: 150,
      sequence: "ABC",
      checked: true,
      families: {
        standard: { letter: "C", windowEnd: "2026-08-11T21:55:00.000Z", votes: 16, of: 16 },
        vault: { letter: "B", windowEnd: "2026-08-11T21:55:00.000Z", votes: 6, of: 6 },
      },
      windowEnd: "2026-08-11T21:55:00.000Z",
      /* `letter` and `stages` are what DE published for that tier, in the
         job's uniqueName and standingStages. Deliberately not on every group:
         the Narmer tiers carry no tier at all, and the fallbacks have to stay
         exercised. Cetus 5-15 has stages and no letter, Cambion Drift 30-40 a
         letter and no stages, the vault both. */
      groups: {
        "Level 5 - 15 Cetus Bounty": {
          family: "standard", rotations: "ABC", stages: 3 },
        "Level 30 - 40 Cambion Drift Bounty": {
          family: "standard", rotations: "AB", letter: "A" },
        "Level 30 - 40 Isolation Vault": {
          family: "vault", rotations: "ABC", letter: "B", stages: 5 },
        /* Publishes two letters and DE named neither, so it falls back to the
           family's C — a letter it does not have. That is the case the row has
           to average rather than claim, and it is why the published letters
           are worth reading: with one, this stops happening. */
        "Level 25 - 30 Cambion Drift Bounty": {
          family: "standard", rotations: "AB" },
      },
      events: {
        "Level 15 - 25 Plague Star": {
          event: "Plague Star",
          activation: "2026-08-01T00:00:00Z", expiry: "2026-08-20T00:00:00Z",
        },
        "Level 15 - 25 Ghoul Bounty": { event: "Ghoul Purge" },
      },
    },
  },
  relics: {},
};

// ── the ordinary round cycle ───────────────────────────────────────────────

test("how far to run a node is decided by the node, not by a setting", () => {
  /* There used to be a *How far you run* control and one answer for the whole
     list. It is worked out per node now: every way of playing it is scored and
     the best rate wins, where the rate is value over rounds-plus-overhead.

     Restarting is what the overhead prices. Without it, leaving after two
     rounds and starting again looked free, so `reset` won everywhere by never
     being charged for the thing it does most. */
  const ROT = loadRotation();
  const run = (rot) => ROT.runValue(rot, "Defense", false, null);

  // Rotation A is all you want: four A rewards over six rounds beats two over
  // two once the trip in and out is charged for.
  const onlyA = run({ A: 1, B: 0, C: 0, none: 0 });
  assert.equal(onlyA.mode, "aabcaa");
  assert.equal(onlyA.rounds, 6);
  assert.deepEqual(plain(onlyA.counts), { A: 4, B: 1, C: 1 });

  // What you want is deeper in the cycle, so staying past it buys rotations
  // you want nothing from.
  const onlyB = run({ A: 0, B: 1, C: 0, none: 0 });
  assert.equal(onlyB.mode, "reset");
  assert.equal(onlyB.rounds, 3, "stops at B rather than running on to C");
  assert.deepEqual(plain(onlyB.counts), { A: 2, B: 1 });

  const mostlyC = run({ A: 0.05, B: 0.1, C: 0.4, none: 0 });
  assert.equal(mostlyC.mode, "reset");
  assert.equal(mostlyC.rounds, 4, "runs to C, because that is what pays here");
});

test("the overhead is what makes staying worth it, and it is only two rounds", () => {
  /* The size of the constant is the whole argument, so it is asserted rather
     than left implicit: at zero, reset wins an A-only node outright (0.300
     against 0.200) and nothing ever stays. Two rounds is a mission start -
     matchmaking, two loading screens, the walk to extraction - and it is enough
     to make the two exactly equal, at which point the tie goes to the run with
     fewer restarts. */
  const ROT = loadRotation();
  assert.equal(ROT.RUN_OVERHEAD, 2);

  const rot = { A: 0.3, B: 0, C: 0, none: 0 };
  const chosen = ROT.runValue(rot, "Defense", false, null);
  assert.equal(chosen.mode, "aabcaa");

  // the two it was choosing between, priced by hand from the same constant
  const reset = 0.6 / (2 + ROT.RUN_OVERHEAD);      // 2 rounds, 2 x rot A
  const aabcaa = 1.2 / (6 + ROT.RUN_OVERHEAD);     // 6 rounds, 4 x rot A
  assert.ok(Math.abs(reset - aabcaa) < 1e-12,
            "a dead heat is what the tie-break is for; got " + reset + " vs " + aabcaa);
});

test("a node with no rotation is added flat, once per run", () => {
  const ROT = loadRotation();
  const flat = ROT.runValue({ A: 0, B: 0, C: 0, none: 0.5 }, "Capture", false, null);
  assert.equal(flat.total, 0.5);
  assert.equal(flat.rounds, null);
});

test("Disruption does not use the AABC cycle, and rotation A needs a squad", () => {
  const ROT = loadRotation();
  const wantA = { A: 1, B: 0, C: 0, none: 0 };
  const solo = ROT.runValue(wantA, "Disruption", false, null);
  assert.equal(solo.total, 0, "defending all four conduits can never reach rotation A");
  assert.ok(solo.stranded.includes("A"));

  const squad = ROT.runValue(wantA, "Disruption", true, null);
  assert.equal(squad.total, 3, "under-defending pays A three times, and only three");
  assert.match(squad.planName, /under-defending/);
});

test("a Prime whose every live relic is Railjack-only is spotted from the data", () => {
  const ROT = loadRotation();
  const relics = {
    "Neo V9": { vaulted: false, sources: [{ node: "Flexa", planet: "Veil Proxima" }] },
    "Axi S8": { vaulted: false, sources: [{ node: "Peregrine Axis", planet: "Saturn" }] },
    "Axi V1": { vaulted: false, sources: [{ node: "Ukko", planet: "Void" }] },
    "Lith Q1": { vaulted: true, sources: [{ node: "Ukko", planet: "Void" }] },
    "Meso Z1": { vaulted: false, sources: [{ node: "Sunkiller", planet: "Earth",
                                            access: "quest" }] },
  };
  const only = (list) => ROT.railjackOnly({ relics: list }, relics);

  assert.equal(only(["Neo V9", "Axi S8"]), true,
               "Proxima by planet and a named node by name - both count");
  assert.equal(only(["Neo V9", "Axi V1"]), false,
               "one star-chart route is enough to stop saying Railjack only");
  assert.equal(only(["Neo V9", "Lith Q1"]), true,
               "a vaulted relic is not a route, so it cannot make one");
  assert.equal(only(["Lith Q1"]), false,
               "nothing live at all is plain vaulted, not Railjack-only");
  assert.equal(only([]), false);
  assert.equal(only(["Neo V9", "Meso Z1"]), true,
               "a quest-only source is not somewhere you can decide to go either");
});

// ── the same run, counted rather than valued ───────────────────────────────

test("the count and the probability come from the rounds the value chose", () => {
  const ROT = loadRotation();
  // worth: a rot A relic is the valuable one; chance: rot C drops far more often.
  // The run has to be the SAME run for both, or the row shows a percentage and a
  // count that cannot both be true.
  const worth = { A: 0.2, B: 0, C: 1, none: 0 };
  const chance = { A: 0.1, B: 0.5, C: 0.5, none: 0 };
  const r = ROT.runValue(worth, "Defense", false, null, chance);

  assert.equal(r.mode, "reset", "the value is in C, so there is no reason to stay past it");
  assert.deepEqual(plain(r.counts), { A: 2, B: 1, C: 1 },
                   "the run goes to C, because a C relic is wanted");
  // 2 x 0.1 + 1 x 0.5 + 1 x 0.5 - rotation B counts even though it is worth
  // nothing, because the run passes through it and you keep what it hands you
  assert.ok(Math.abs(r.count - 1.2) < 1e-12, "expected wanted relics, got " + r.count);
  // 1 - (0.9^2 x 0.5 x 0.5)
  assert.ok(Math.abs(r.any - 0.7975) < 1e-12, "P(at least one), got " + r.any);
});

test("counting is skipped entirely when nothing asks for it", () => {
  const ROT = loadRotation();
  const r = ROT.runValue({ A: 1, B: 0, C: 0, none: 0 }, "Defense", false, null);
  assert.equal(r.count, undefined, "no alt map, no count - not a silent zero");
  assert.equal(r.any, undefined);
});

test("a chance over 100% across one table is held at certainty", () => {
  const ROT = loadRotation();
  // several wanted relics in one table can sum past 1; one roll cannot pay twice
  const r = ROT.runValue({ A: 1, B: 0, C: 0, none: 0 }, "Defense", false, null,
                         { A: 1.4, B: 0, C: 0, none: 0 });
  // rotation A is all this node pays, so the run stays for four of them
  assert.equal(r.count, 4, "four rolls at certainty, never 5.6");
  assert.equal(r.any, 1);
});

test("a flat node counts its single roll, and no rounds", () => {
  const ROT = loadRotation();
  const r = ROT.runValue({ A: 0, B: 0, C: 0, none: 0.5 }, "Capture", false, null,
                         { A: 0, B: 0, C: 0, none: 0.25 });
  assert.equal(r.count, 0.25);
  assert.equal(r.any, 0.25);
});

test("a run is costed in objectives, and each type has its own word for one", () => {
  const ROT = loadRotation();
  const o = (n) => plain(ROT.objectivesOf(n));
  assert.deepEqual(o({ mode: "Defense", rounds: 4 }), { count: 4, unit: "round" });
  assert.deepEqual(o({ mode: "Capture", rounds: null }), { count: 1, unit: "run" },
                   "nothing to count inside a single-reward mission");
  assert.deepEqual(o({ mode: "Bounty", rounds: null, bounty: { letter: "A" } }),
                   { count: 4, unit: "stage" },
                   "a bounty is not on the round cycle, so it is costed in stages");
});

test("a fixed-length mission is costed at its real length, not a chosen one", () => {
  /* This test used to hand objectivesOf its own answer -- it passed
     `{ mode: "Spy", rounds: 3 }` and asserted 3 came back, so it had never seen
     the 4 the model actually produced. The length is now driven out of
     runValue, which is where the wrong number was being invented.

     `runValue`'s result carries its own `mode` -- the RUN mode, "fixed" -- so
     the spread has to come first or it silently overwrites the mission type and
     the assertion measures nothing. */
  const ROT = loadRotation();
  const cost = (mission, rot) => {
    const r = ROT.runValue(rot, mission, false, null, rot, false);
    return { ...plain(ROT.objectivesOf({ ...r, mode: mission })), runMode: r.mode,
             rewards: r.rounds, counts: plain(r.counts) };
  };

  // Spy: three vaults, and the wiki says vault 1/2/3 pays A/B/C
  const spy = cost("Spy", { A: 0.2, B: 0.2, C: 0.2 });
  assert.deepEqual({ count: spy.count, unit: spy.unit }, { count: 3, unit: "vault" });
  assert.equal(spy.runMode, "fixed", "a Spy run has no length to choose");
  assert.deepEqual(spy.counts, { A: 1, B: 1, C: 1 },
                   "each vault pays its own rotation, once");

  /* The six live nodes this was held for. Value ONLY in rotation C, which the
     AABC cycle never reaches in three rounds -- capping the length without the
     letters would have scored these zero. */
  const cOnly = cost("Spy", { A: 0, B: 0, C: 0.62 });
  assert.ok(cOnly.count === 3 && cOnly.counts.C === 1,
            "a C-only Spy node must still reach C on its third vault");
  assert.ok(ROT.runValue({ A: 0, B: 0, C: 0.62 }, "Spy", false, null,
                         { A: 0, B: 0, C: 0.62 }, false).total > 0,
            "Pago, Bode, Valac, Aegaeon, Amalthea and Dione hold all their value here");

  // Caches: two cache rewards, rotation A then rotation B -- not three, not a cycle
  const caches = cost("Caches", { A: 0.3, B: 0.19 });
  assert.deepEqual({ count: caches.count, unit: caches.unit }, { count: 2, unit: "cache" });
  assert.deepEqual(caches.counts, { A: 1, B: 1 });

  // Faceoff: one match paying one each of A and B
  const faceoff = cost("Special", { A: 0.1, B: 0.1 });
  assert.deepEqual({ count: faceoff.count, unit: faceoff.unit }, { count: 1, unit: "run" });
  assert.deepEqual(faceoff.counts, { A: 1, B: 1 },
                   "a match pays both letters, so it is two rewards in one run");

  // and none of them may be talked into the endless optimiser's lengths
  for (const m of ["Spy", "Caches", "Special"]) {
    const r = ROT.runValue({ A: 0.3, B: 0.3, C: 0.3 }, m, false, null,
                           { A: 0.3, B: 0.3, C: 0.3 }, false);
    assert.equal(r.mode, "fixed", `${m} was offered a run length it cannot have`);
    assert.ok(r.rounds <= 3, `${m} banked ${r.rounds} rewards`);
  }
});

test("a fissure cannot talk a fixed-length mission into staying", () => {
  /* Dormant only because the shipped build has no live fissures: a Spy node
     that is a fissure took the `bonus` branch and was run to FIVE vaults with a
     free endless-fissure relic attached. The free relic is for staying in an
     endless fissure; a Spy mission has nothing to stay in. */
  const ROT = loadRotation();
  const rot = { A: 0.2, B: 0.2, C: 0.2 };
  const asFissure = ROT.runValue(rot, "Spy", false, null, rot, true);
  assert.equal(asFissure.mode, "fixed", "a Spy fissure is still three vaults");
  assert.equal(ROT.objectivesOf({ ...asFissure, mode: "Spy" }).count, 3);

  // the endless types keep the bonus, so this narrowed nothing it should not
  const defense = ROT.runValue(rot, "Defense", false, null, rot, true);
  assert.equal(defense.mode, "bonus", "an endless fissure still pays for depth");
});

test("an Onslaught reward costs two zones, so the run is twice the objectives", () => {
  /* The bug this guards: `rounds` counts *rewards*, and Onslaught pays one per
     two zones, so charging the reward count as the objective count priced a
     twelve-zone run at six and ranked both Onslaught nodes at exactly twice
     their true rate. The letters were never wrong - only the price.

     Driven through `runValue` rather than handing `objectivesOf` a rounds
     figure by hand: the point is what the model actually produces. The spread
     comes first because `runValue` returns its own `mode` - the run mode - and
     the mission type has to win. */
  const ROT = loadRotation();
  const rot = { A: 1, B: 0, C: 0, none: 0 };

  const eso = ROT.runValue(rot, "Sanctuary Onslaught", false, null);
  assert.equal(eso.rounds, 6, "six rewards, the same AABC run any endless node gets");
  assert.deepEqual(plain(ROT.objectivesOf({ ...eso, mode: "Sanctuary Onslaught" })),
                   { count: 12, unit: "zone" },
                   "six rewards is twelve zones - the wiki gives one reward per two");

  /* The control. Same rot map, same reward count, a mission that really does
     pay per round: the two numbers stay equal, so the test above is about the
     mission type and not about the arithmetic. */
  const def = ROT.runValue(rot, "Defense", false, null);
  assert.equal(def.rounds, 6);
  assert.deepEqual(plain(ROT.objectivesOf({ ...def, mode: "Defense" })),
                   { count: 6, unit: "round" },
                   "a Defense round pays a reward, so rewards and objectives agree");
});

test("a Profit-Taker phase is one run, not four bounty stages", () => {
  /* DE file the heist's rewards inside the bounty table, so it arrived here as
     a four-stage bounty: its rate was divided by four and it sank down the list
     accordingly. Each phase is a whole activity you replay on its own - the
     `Old Mate` tooltip says exactly that, and the four rows exist because of it.

     The node name is the subject rather than anything the model derives, so a
     classifier that stopped recognising the heist cannot make this pass by
     finding nothing. */
  const ROT = loadRotation();
  const o = (node) => plain(ROT.objectivesOf(
    { node, mode: "Bounty", rounds: null, bounty: { letter: null } }));
  assert.deepEqual(o("Level 40 - 60 PROFIT-TAKER - PHASE 1"), { count: 1, unit: "run" });
  assert.deepEqual(o("Level 50 - 60 PROFIT-TAKER - PHASE 4"), { count: 1, unit: "run" });
  assert.deepEqual(o("Level 20 - 40 Cetus Bounty"), { count: 4, unit: "stage" },
                   "and an ordinary bounty is still costed in stages");
});

// ── the bounty clock ───────────────────────────────────────────────────────

test("the live letter is the one the build read, until its window ends", () => {
  const ROT = loadRotation({ data: BOUNTY_DATA });
  const live = ROT.liveRotation("Level 5 - 15 Cetus Bounty");
  assert.equal(live.letter, "C");
  assert.equal(live.endsAt, Date.parse("2026-08-11T21:55:00.000Z"));
  assert.equal(ROT.untilText(live.endsAt), "55 min");
});

test("the letter is walked forward from a stale anchor, not left behind", () => {
  // the exact case that broke: an --offline build anchored three windows back.
  // C -> A -> B -> C over three changeovers, 7h10m after the anchor expired.
  const ROT = loadRotation({
    data: BOUNTY_DATA, now: Date.parse("2026-08-12T05:05:00Z"),
  });
  const live = ROT.liveRotation("Level 5 - 15 Cetus Bounty");
  assert.equal(live.letter, "C", "three whole cycles on from C is C again");
  assert.equal(live.endsAt, Date.parse("2026-08-12T05:25:00Z"));

  const one = loadRotation({ data: BOUNTY_DATA, now: Date.parse("2026-08-11T22:00:00Z") });
  assert.equal(one.liveRotation("Level 5 - 15 Cetus Bounty").letter, "A",
               "five minutes past the window, C has become A");
});

test("exactly on the boundary the window has turned over, not stalled", () => {
  const ROT = loadRotation({
    data: BOUNTY_DATA, now: Date.parse("2026-08-11T21:55:00.000Z"),
  });
  assert.equal(ROT.liveRotation("Level 5 - 15 Cetus Bounty").letter, "A");
});

test("the vaults keep their own phase", () => {
  const ROT = loadRotation({ data: BOUNTY_DATA });
  assert.equal(ROT.liveRotation("Level 5 - 15 Cetus Bounty").letter, "C");
  assert.equal(ROT.liveRotation("Level 30 - 40 Isolation Vault").letter, "B",
               "one letter everywhere was the wiki's claim, not the worldstate's");
  /* One letter per group on the clock, in name order: Cambion Drift 25-30 (no
     published letter, so its family's C), Cambion Drift 30-40 (published A),
     the vault (published B), Cetus (its family's C). Read from the groups
     rather than the families because the groups are what rows are scored on,
     and a build can now name their letters without the families having been
     derived at all. */
  assert.equal(ROT.stamp(), "CABC");
});

test("a letter DE published for a tier beats the one derived for its family", () => {
  /* The derived answer is one letter for a whole family, and the tiers
     genuinely disagree: read on 2026-08-24, every Ostron and Solaris tier was
     on C while three of six Cambion Drift tiers were on A. One of those three
     publishes only rotations A and B, so the family answer was naming it a
     letter it does not have — which the row then had to paper over as
     "unknown".

     `Level 30 - 40 Cambion Drift Bounty` is that tier, and it is the subject
     here for that reason. */
  const ROT = loadRotation({ data: BOUNTY_DATA });
  const derived = ROT.liveRotation("Level 5 - 15 Cetus Bounty");
  assert.equal(derived.letter, "C", "no published letter, so the family answers");

  const published = ROT.liveRotation("Level 30 - 40 Cambion Drift Bounty");
  assert.equal(published.letter, "A",
               "DE published A for this tier while its family was derived as C");
  assert.equal(published.endsAt, Date.parse("2026-08-11T21:55:00.000Z"),
               "and it turns over with everything else, not on a clock of its own");

  // and it walks forward from the published anchor exactly as a family does
  const later = loadRotation({ data: BOUNTY_DATA, now: Date.parse("2026-08-11T22:00:00Z") });
  assert.equal(later.liveRotation("Level 30 - 40 Cambion Drift Bounty").letter, "B",
               "five minutes past the window, A has become B");
});

test("a bounty is costed at the stages DE says it has, not always four", () => {
  /* `standingStages` has one entry per stage and its length is 3, 4 or 5 by
     tier — a level 5-15 bounty is three stages and a level 40-60 is five.
     Costing every one of them at four divided the short ones' rate by too much
     and the long ones' by too little.
     Four remains the fallback for a bounty DE did not publish: the Narmer
     tiers carry no tier at all, and a mirror build has no worldstate. */
  const ROT = loadRotation({ data: BOUNTY_DATA });
  const cost = (node) => {
    const live = ROT.liveRotation(node);
    const run = ROT.runValue({ A: 1, B: 1, C: 1 }, "Bounty", false, live, null);
    return plain(ROT.objectivesOf({ node, mode: "Bounty", ...run }));
  };
  assert.deepEqual(cost("Level 5 - 15 Cetus Bounty"), { count: 3, unit: "stage" });
  assert.deepEqual(cost("Level 30 - 40 Isolation Vault"), { count: 5, unit: "stage" });
  assert.deepEqual(cost("Level 30 - 40 Cambion Drift Bounty"), { count: 4, unit: "stage" },
                   "no stage count published for this one, so four stands");
});

test("when a letter next comes up is arithmetic on the sequence", () => {
  const ROT = loadRotation({ data: BOUNTY_DATA });
  const end = Date.parse("2026-08-11T21:55:00.000Z");
  assert.equal(ROT.whenNext("C", end, "A"), end, "A follows C immediately");
  assert.equal(ROT.whenNext("C", end, "B"), end + 150 * 60000);
  assert.equal(ROT.whenNext("C", end, "C"), end + 300 * 60000, "all the way round");
});

test("a bounty run pays the live letter and nothing else", () => {
  const ROT = loadRotation({ data: BOUNTY_DATA });
  const live = ROT.liveRotation("Level 5 - 15 Cetus Bounty");      // C
  const r = ROT.runValue({ A: 5, B: 3, C: 1, none: 0 }, "Bounty", false, live);
  assert.equal(r.total, 1, "the A and B rewards are a wait, not a longer run");
  assert.equal(r.rounds, null, "a bounty is not costed in rounds");
  assert.deepEqual(plain(r.counts), { C: 1 });
  assert.deepEqual(plain(r.stranded), ["A", "B"]);
  assert.equal(r.bounty.letter, "C");
});

test("a bounty that does not publish the live letter is averaged, and says so", () => {
  const ROT = loadRotation({ data: BOUNTY_DATA });
  // DE named no letter for this one, so it falls back to its family's C — a
  // letter its own table does not have. The subject moved here when the tier
  // it used to use gained a published letter and stopped being off-table.
  const live = ROT.liveRotation("Level 25 - 30 Cambion Drift Bounty");  // board on C, table AB
  const r = ROT.runValue({ A: 4, B: 2, C: 0, none: 0 }, "Bounty", false, live);
  assert.equal(r.total, 3, "the mean of what it does publish");
  assert.equal(r.bounty.letter, null);
  assert.equal(r.bounty.offTable, true);
  assert.equal(r.bounty.live, "C", "and remembers what the board is on");
});

test("a single-table bounty has nothing to wait for", () => {
  const ROT = loadRotation({ data: BOUNTY_DATA });
  const live = ROT.liveRotation("Level 15 - 25 Plague Star");   // not in groups at all
  const r = ROT.runValue({ A: 2, B: 0, C: 0, none: 0 }, "Bounty", false, live);
  assert.equal(r.total, 2);
  assert.equal(r.bounty.unknown, false, "one table is not an unknown rotation");
});

test("with no bounty data at all the letter is unknown, never guessed", () => {
  const ROT = loadRotation({ data: { meta: {}, relics: {} } });
  const live = ROT.liveRotation("Level 5 - 15 Cetus Bounty");
  assert.equal(live.letter, null);
  const r = ROT.runValue({ A: 4, B: 2, C: 0, none: 0 }, "Bounty", false, live);
  assert.equal(r.total, 3, "the mean, flagged unknown - not the sum");
  assert.equal(r.bounty.unknown, true);
});

test("countdowns read as minutes below an hour and h/m above", () => {
  const ROT = loadRotation({ data: BOUNTY_DATA });
  const now = Date.parse("2026-08-11T21:00:00Z");
  assert.equal(ROT.untilText(now + 42 * 60000), "42 min");
  assert.equal(ROT.untilText(now + 192 * 60000), "3h 12m");
  assert.equal(ROT.untilText(now - 60000), "0 min", "a lapsed window never reads negative");
});

// ── which sources count ────────────────────────────────────────────────────

test("a limited-time bounty counts as an event node only while it is not running", () => {
  const ROT = loadRotation({ data: BOUNTY_DATA });          // 2026-08-11, Plague Star live
  const star = { kind: "bounty", node: "Level 15 - 25 Plague Star", planet: "Cetus (Plains of Eidolon)" };
  const ghoul = { kind: "bounty", node: "Level 15 - 25 Ghoul Bounty", planet: "Cetus (Plains of Eidolon)" };
  assert.equal(ROT.isEventNode(star), false, "running: in the ranking by default");
  assert.equal(ROT.isEventNode(ghoul), true, "no window at all: not on the board");

  const after = loadRotation({ data: BOUNTY_DATA, now: Date.parse("2026-09-01T00:00:00Z") });
  assert.equal(after.isEventNode(star), true, "the operation ended, so it drops out");
});

test("a node says what it demands before you can play it", () => {
  const ROT = loadRotation({ data: BOUNTY_DATA });
  const demands = (node, extra) =>
    ROT.demandsOf(Object.assign({ node, planet: "Rotating / Event" }, extra))
      .map((d) => d.label);
  // Railjack needs a ship and its own star chart; Faceoff matches you against
  // other players. Neither is a drawback in the ranking, but a node named
  // "Arva Vector" gives no hint of either.
  assert.deepEqual(plain(demands("Arva Vector")), ["Railjack"]);
  assert.deepEqual(plain(demands("Faceoff: Single Squad")), ["PvPvE"]);
  assert.deepEqual(plain(demands("Ukko", { planet: "Void" })), [],
                   "an ordinary node demands nothing and says nothing");
  // the regex once contained a literal backspace instead of a word boundary,
  // which matched nothing at all and failed silently
  assert.equal(ROT.isPvPvE({ node: "Faceoff: Single Squad" }), true);
  assert.equal(ROT.isPvPvE({ node: "Facsimile" }), false);

  // a Steel Path node stacks its demand on top of whatever else it asks
  assert.deepEqual(plain(demands("Faceoff: Squad VS Squad (Steel Path)")),
                   ["PvPvE", "Steel Path"]);
});

test("a node carrying a fissure is run to five rotations, whatever the rate says", () => {
  /* An endless Void Fissure pays a free Exceptional relic for reaching five
     rotations. That is value the rate cannot see - it is not in the drop table
     at all - so a fissure is *chosen* rather than compared: the run goes to
     five and the arithmetic does not get a vote.

     Deliberately tested on a node the rate would otherwise run differently, or
     it proves nothing. */
  const ROT = loadRotation();
  assert.equal(ROT.bonusRotations, 5);

  const onlyB = { A: 0, B: 1, C: 0, none: 0 };
  assert.equal(ROT.runValue(onlyB, "Defense", false, null, null, false).mode, "reset",
               "with no fissure this one leaves as soon as B drops");

  const fissure = ROT.runValue(onlyB, "Defense", false, null, null, true);
  assert.equal(fissure.mode, "bonus");
  assert.equal(fissure.rounds, 5, "exactly the depth the bonus is paid at");
  // AABCA over five rounds - the fifth is a second lap of rotation A
  assert.deepEqual(plain(fissure.counts), { A: 3, B: 1, C: 1 });

  // a mission with no rotation cannot stay for anything, so it gets no rounds
  assert.equal(ROT.runValue({ A: 0, B: 0, C: 0, none: 0.5 },
                            "Capture", false, null, null, true).rounds, null);
});

test("an enemy says it is an enemy, and names the event it rides", () => {
  const ROT = loadRotation();
  /* The Hemocyte is the only enemy in DE's entire relic table, and it is not a
     destination: four spawn in the final stage of the Plague Star bounty, so
     its row and the Plague Star row are one trip counted twice. */
  const demand = ROT.demandsOf({ kind: "enemy", node: "Hemocyte",
                                 access: "event:Plague Star" })[0];
  assert.equal(demand.label, "Enemy");
  assert.match(demand.tip, /not a destination/i);
  assert.match(demand.tip, /Plague Star/, "the row has to name what it rides");

  const bare = ROT.demandsOf({ kind: "enemy", node: "Something" })[0];
  assert.equal(bare.label, "Enemy");
  assert.ok(!/final stage/.test(bare.tip),
            "with no event known it must not invent one");

  assert.deepEqual(plain(ROT.demandsOf({ kind: "mission", node: "Ukko" })), [],
                   "an ordinary node is not an enemy");
});

test("the Profit-Taker heist asks for standing, and says so", () => {
  const ROT = loadRotation();
  const labels = (node) => ROT.demandsOf({ kind: "bounty", node }).map((d) => d.label);
  assert.deepEqual(plain(labels("Level 40 - 60 PROFIT-TAKER - PHASE 1")), ["Old Mate"]);
  assert.deepEqual(plain(labels("Level 50 - 60 PROFIT-TAKER - PHASE 4")), ["Old Mate"]);
  assert.deepEqual(plain(labels("Level 15 - 25 Plague Star")), [],
                   "an ordinary board bounty asks for nothing extra");
  assert.match(ROT.demandsOf({ node: "Level 40 - 60 PROFIT-TAKER - PHASE 1" })[0].tip,
               /Rank 5/, "the tip has to name the rank, not just imply a gate");
});

test("two nodes are the same bet only when the table AND the mode match", () => {
  const ROT = loadRotation();
  const node = (over) => Object.assign({
    node: "Cambria", planet: "Earth", mode: "Defense", lvl: [2, 5], aya: 0,
    relics: new Map([["Lith A1", { chance: 11.06, rotation: "A" }],
                     ["Meso B2", { chance: 25.33, rotation: "C" }]]),
  }, over);

  const base = ROT.signature(node());
  assert.equal(ROT.signature(node({ node: "Hapke", planet: "Phobos", lvl: [3, 7] })),
               base, "same table, same mode, different rock - one bet");

  /* Identical tables across different modes are common: Survival and Excavation
     share several. Those are the same reward from a different activity, which
     is a choice worth keeping rather than a duplicate worth hiding. */
  assert.notEqual(ROT.signature(node({ mode: "Excavation" })), base,
                  "same table, different activity - not the same bet");
  assert.notEqual(ROT.signature(node({
    relics: new Map([["Lith A1", { chance: 11.06, rotation: "A" }]]) })), base,
    "a different table is a different bet even at the same node type");
  assert.notEqual(ROT.signature(node({
    relics: new Map([["Lith A1", { chance: 2.5, rotation: "A" }],
                     ["Meso B2", { chance: 25.33, rotation: "C" }]]) })), base,
    "same relics at different rates is a different bet");
});

test("the node named for a group is the one the tie-breaks would have picked", () => {
  const ROT = loadRotation();
  const n = (node, lvl, aya) => ({ node, planet: "X", lvl, aya: aya || 0 });

  /* The ranking breaks ties on Aya then lowest level, so the fold has to pick
     the same way - otherwise the fine print recommends a node the list itself
     would have put second. */
  assert.equal(ROT.pickNode([n("Casta", [12, 17]), n("Lith", [2, 5]),
                             n("Spear", [8, 12])]).node, "Lith",
               "lowest enemy level wins when nothing else separates them");
  assert.equal(ROT.pickNode([n("Lith", [2, 5]), n("Casta", [12, 17], 4.17)]).node,
               "Casta", "Aya outranks a lower level, exactly as the sort does");
  assert.equal(ROT.pickNode([n("Zeta", null), n("Alpha", null)]).node, "Alpha",
               "with nothing to separate them, the name - so it never wobbles");

  /* A fissure goes ahead of both. These nodes are the same bet by construction,
     so naming the one you can also crack a relic at costs nothing - and naming
     any other would be recommending the identical node without the free relic. */
  const hot = (x) => x.node === "Casta";
  assert.equal(ROT.pickNode([n("Lith", [2, 5], 4.17), n("Casta", [90, 95])], hot).node,
               "Casta", "a fissure outranks Aya and the lowest level together");
  assert.equal(ROT.pickNode([n("Lith", [2, 5]), n("Casta", [90, 95])],
                            () => false).node, "Lith",
               "and when none of them is one, nothing about the old order moves");
});

test("a Railjack cache is halved, and nothing else in the model is", () => {
  const ROT = loadRotation();
  const cache = (extra) => ROT.isRailjackCache(Object.assign(
    { mode: "Caches", node: "Arva Vector", planet: "Neptune" }, extra));

  assert.equal(ROT.cachePenalty, 0.5, "the one judgement in the model, named once");
  assert.equal(cache(), true, "a named Railjack node counts even on an ordinary planet");
  assert.equal(cache({ node: "Flexa", planet: "Veil Proxima" }), true);
  assert.equal(cache({ mode: "Skirmish" }), false,
               "a Skirmish is what people actually run Railjack for");
  assert.equal(cache({ node: "Ukko", planet: "Void" }), false,
               "a Caches mode somewhere else would not have earned this");
  assert.equal(ROT.isRailjackCache({}), false);
});

test("a fissure that has closed is gone, whatever the build said", () => {
  /* This is the one list in the app with a shelf life. The build ships whatever
     was running when it ran; the page is opened hours later. Everything here is
     about the direction the error goes - it must lose fissures that are still
     up rather than keep ones that are not, because the second kind sends
     somebody to an empty node. */
  const now = Date.parse("2026-08-11T21:00:00Z");
  const at = (mins) => new Date(now + mins * 60000).toISOString();
  const ROT = loadRotation({ now });
  /* The shape build_data emits: no `mode`. It carried the worldstate's
     missionType, nothing read it, and it was dropped rather than left as
     unfiltered upstream text in the payload. */
  const F = (o) => Object.assign(
    { node: "?", tier: "Lith", hard: false, storm: false }, o);

  const HERE = "Coba (Earth)";
  const gone = F({ node: HERE, tier: "Axi", ends: at(-1) });
  const soon = F({ node: HERE, tier: "Meso", ends: at(30) });
  const later = F({ node: HERE, tier: "Lith", ends: at(90) });
  const storm = F({ node: HERE, tier: "Neo", ends: at(200), storm: true });
  const elsewhere = F({ node: "Hydron (Sedna)", tier: "Lith", ends: at(200) });
  const list = [gone, soon, storm, elsewhere, later];

  const named = (allowStorm, from, node) =>
    plain(ROT.fissuresAt(from === undefined ? list : from,
                         node || HERE, now, allowStorm)).map((f) => f.tier);

  assert.deepEqual(named(false), ["Lith", "Meso"],
                   "expired dropped, longest remaining named first");
  assert.deepEqual(named(true), ["Neo", "Lith", "Meso"],
                   "a Void Storm only counts when Railjack is switched on");
  assert.deepEqual(named(true, undefined, "Hydron (Sedna)"), ["Lith"],
                   "another node's fissure is another node's business");
  assert.deepEqual(named(true, undefined, "Nowhere (Mars)"), []);
  assert.deepEqual(named(true, []), []);
  assert.deepEqual(named(true, null), [],
                   "an old build carries no list at all, which is not an error");

  // Ten seconds left is not eleven minutes, and it is not nothing either.
  assert.equal(ROT.minutesLeft(soon, now), 30);
  assert.equal(ROT.minutesLeft(F({ ends: new Date(now + 659000).toISOString() }), now), 10,
               "floored, so a badge never claims more time than there is");
  assert.equal(ROT.minutesLeft(gone, now), 0, "closing now reads as 0, not as -1");
});

test("the Steel Path is recognised by name, and by the tier the wiki gates", () => {
  const ROT = loadRotation();
  const sp = (node) => ROT.isSteelPath({ node });

  assert.equal(sp("Faceoff: Single Squad (Steel Path)"), true);
  assert.equal(sp("Faceoff: Squad VS Squad (Steel Path Winner)"), true,
               "DE writes one of them with a trailing word inside the bracket");
  /* Not named, but gated: the wiki's Bounty page gives the 100-100 tier
     "Requires Mastery Rank 10 and unlock The Steel Path". No 100-100 tier
     carries a relic today, so this is written for the day one does. */
  assert.equal(sp("Level 100 - 100 Cetus Bounty"), true);
  assert.equal(sp("Level 100-100 Orb Vallis Bounty"), true, "spacing varies");

  assert.equal(sp("Faceoff: Single Squad"), false);
  assert.equal(sp("Level 40 - 60 Cetus Bounty"), false);
  assert.equal(sp("Steel Meridian Relay"), false,
               "the words alone are not the marker - it is the bracket");
  assert.equal(sp(""), false);
  assert.equal(ROT.isSteelPath({}), false);
});

test("Event: nodes and Railjack are recognised however they are spelled", () => {
  const ROT = loadRotation({ data: BOUNTY_DATA });
  assert.equal(ROT.isEventNode({ planet: "Event: Sedna", node: "Camenae" }), true);
  assert.equal(ROT.isEventNode({ planet: "Sedna", node: "Camenae" }), false);
  assert.equal(ROT.isRailjack({ planet: "Veil Proxima", node: "Arva Vector" }), true);
  assert.equal(ROT.isRailjack({ planet: "Earth", node: "Iota Temple" }), true);
  assert.equal(ROT.isRailjack({ planet: "Earth", node: "Lith" }), false);
});

// ── the shared store and helpers ───────────────────────────────────────────

test("the six storage keys are the ones the pages have always used", () => {
  const { S } = loadShared();
  assert.deepEqual(plain(S.KEYS), {
    collected: "wfprimes.collected.v1",
    parts: "wfprimes.parts.v1",
    materials: "wfprimes.materials.v1",
    wishlist: "wfprimes.wishlist.v1",
    plan: "wfprimes.plan.v1",
    filters: "wfprimes.filters.v1",
  }, "renaming one of these silently orphans saved progress");
});

/* The single-file build runs app.js and plan.js over one document, so every
   shared wiring call happens twice. Guarding that with a plain "run once" is
   right for four of them and wrong for this one, invisibly: app.js calls it
   first and passes no callback, so keeping only the first caller's would leave
   the planner never repainting a fissure that opened while the page was open.
   The failure is silent, it is only reachable in `dist/`, and nothing on
   either page on its own would show it - which is the whole reason this test
   exists rather than a comment saying "careful here". */
test("two callers of the fissure watcher share one poller and both are heard", async () => {
  const timers = [];
  let asked = 0;
  const fetchStub = () => {
    asked++;
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ fissures: [{ node: "Hydron", tier: "Meso" }] }),
    });
  };
  const data = { fissures: [] };
  const { S } = loadShared({ data, fetch: fetchStub, timers });

  const heard = [];
  S.watchFissures();                              // app.js passes none
  S.watchFissures(() => heard.push("planner"));   // plan.js passes its repaint

  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));

  assert.equal(timers.length, 1, "one repeating poll, however many callers there are");
  assert.equal(asked, 1, "and one request on load, not one per caller");
  assert.deepEqual(heard, ["planner"],
                   "the callback of a caller that did not start the poller must still run");
  assert.equal(data.fissures.length, 1,
               "and the list is spliced in place, because both pages hold a reference to it");
});

/* The banner's bugs have always been in what it says, never in where it was
   put — so what it says is a string a test can hold, and this is the one that
   holds it. The wording here shipped to GitHub Pages on 2026-08-27 reading
   "could not reach api_events, api_fissures, api_syndicatemissions,
   api_vaulttrader": four internal keys, to a stranger, under a heading that
   implied the whole catalogue was behind. It was not. */
test("a stale live feed is named for the reader, dated, and does not condemn the catalogue", () => {
  const { S } = loadShared();
  const NOW = Date.parse("2026-08-27T09:00:00Z");
  const meta = {
    generated: "2026-08-27T06:58:00Z",
    stale: ["api_events", "api_fissures", "api_syndicatemissions", "api_vaulttrader"],
    staleSince: "2026-08-27T03:05:00Z",
    degraded: [],
  };

  const guest = S.staleNotice(meta, undefined, false, NOW);
  assert.equal(guest.level, "warn", "a live feed being behind is not a broken build");
  assert.ok(!/api_/.test(guest.html),
            `no reader outside this repo knows what api_fissures is: ${guest.html}`);
  assert.match(guest.html, /Void Fissures, bounty rotations and Prime Resurgence/,
               "the four keys are three things, and each has a name people use");
  assert.match(guest.html, /a copy made 6 hours ago/,
               "how far behind is the whole question; the old text never said");
  assert.match(guest.html, /catalogue, relics and drop tables are current/,
               "167 items and 763 relics were built minutes ago and must not be implied stale");
  assert.ok(!/refresh-data/.test(guest.html), "a guest cannot run anything");

  /* The owner is the one party a source key helps, and the only one told how. */
  const owner = S.staleNotice(meta, undefined, true, NOW);
  assert.match(owner.html, /api_events, api_fissures, api_syndicatemissions, api_vaulttrader/);
  assert.match(owner.html, /refresh-data/);

  /* A source outside the live-worldstate set withdraws the reassurance rather
     than being named wrongly — the claim is only true while every reused
     source is one of the four. */
  const wider = S.staleNotice({ ...meta, stale: meta.stale.concat(["api_items"]) },
                              undefined, false, NOW);
  assert.ok(!/are current/.test(wider.html),
            "the catalogue's own source was reused, so nothing may promise it is current");

  /* And with nothing wrong, the banner says nothing at all. */
  assert.equal(S.staleNotice({ generated: "2026-08-27T06:58:00Z", stale: [], degraded: [] },
                             undefined, false, NOW), null);
});

test("the banner's other three states still say their own thing", () => {
  const { S } = loadShared();
  const NOW = Date.parse("2026-08-27T09:00:00Z");
  const fresh = "2026-08-27T06:58:00Z";

  const moved = S.staleNotice({ generated: fresh }, { stale: true, moved: ["droptables"] }, false, NOW);
  assert.match(moved.html, /Out of date/);

  const degraded = S.staleNotice({ generated: fresh, degraded: ["api_items"] }, undefined, false, NOW);
  assert.equal(degraded.level, "bad", "missing data is a different severity from late data");
  assert.match(degraded.html, /Some data is missing/);

  const old = S.staleNotice({ generated: "2026-07-01T00:00:00Z" }, undefined, false, NOW);
  assert.match(old.html, /This data is 57 days old/);
});

test("load falls back rather than throwing on a corrupt store", () => {
  const { S, ctx } = loadShared();
  S.save(S.KEYS.parts, { "warframe-xaku-prime": { Chassis: 1 } });
  assert.deepEqual(plain(S.load(S.KEYS.parts, {})), { "warframe-xaku-prime": { Chassis: 1 } });
  assert.deepEqual(S.load("wfprimes.nothing.here", "fallback"), "fallback");
  ctx.localStorage.setItem(S.KEYS.parts, "{not json");
  assert.deepEqual(plain(S.load(S.KEYS.parts, {})), {}, "a corrupt store must not white-screen the page");
});

test("four players cracking the same relic see the best of four rolls", () => {
  const { S } = loadShared();
  assert.equal(Math.round(S.squadOdds(0.2533) * 1000) / 10, 68.9);
  assert.equal(S.squadOdds(0), 0);
  assert.equal(S.squadOdds(1), 1);
});

test("esc closes every hole the templates could open", () => {
  const { S } = loadShared();
  assert.equal(S.esc(`<img src=x onerror="alert('&')">`),
               "&lt;img src=x onerror=&quot;alert(&#39;&amp;&#39;)&quot;&gt;");
  assert.equal(S.esc(null), "");
  assert.equal(S.esc(0), "0", "zero is a value, not an absence");
});

test("both pages name a run's cost with the same words", () => {
  /* The two pages built this string separately and diverged the moment Faceoff
     became a one-run mission: the planner said "one run", the collection page
     "1 run". The phrasing lives in rotation.js now, and this is the assertion
     that it stays there -- app.js and plan.js both call objectivesText, so a
     divergence has to go through this function to happen. */
  const ROT = loadRotation();
  const cost = (mission, rot) => {
    const r = ROT.runValue(rot, mission, false, null, rot, false);
    return ROT.objectivesText({ ...r, mode: mission });
  };
  assert.equal(cost("Spy", { A: 0.2, B: 0.2, C: 0.2 }), "3 vaults");
  assert.equal(cost("Caches", { A: 0.3, B: 0.19 }), "2 caches");
  assert.equal(cost("Defense", { A: 0.2, B: 0.2, C: 0.2 }), "6 rounds");
  assert.equal(cost("Sanctuary Onslaught", { A: 0.2, B: 0.2, C: 0.2 }), "12 zones");

  /* A single whole mission reads as words, not as "1 run" -- that is the case
     that diverged, and Faceoff is the live instance of it. */
  assert.equal(cost("Special", { A: 0.1, B: 0.1 }), "one run");
  assert.equal(ROT.objectivesText({ mode: "Capture", rounds: null }), "one run");

  // and a count of one that is NOT a run keeps its unit and stays singular
  assert.equal(ROT.objectivesText({ mode: "Defense", rounds: 1, counts: { A: 1 } }),
               "1 round");
});

/* ── one predicate for "can the reader get there" ────────────────────────
 * There used to be two. The planner's node loop applied three tests while the
 * *Still needed* panel counted on `!vaulted` alone, so the panel claimed relics
 * the reader was not being sent for -- live on three Lex Prime parts. Both sides
 * call reachableSource now, and these are the cases that would let them drift
 * apart again.
 */

test("a source is reachable only when nothing the reader set excludes it", () => {
  const ROT = loadRotation();
  const OFF = { railjack: false, event: false };
  const ON = { railjack: true, event: true };
  const plain = { planet: "Earth", node: "Cambria", mode: "Spy" };

  assert.equal(ROT.reachableSource(plain, OFF), true, "an ordinary star-chart node");
  assert.equal(ROT.reachableSource(plain, ON), true);
  assert.equal(ROT.reachableSource(plain), true, "a missing opts means no opt-ins");
  assert.equal(ROT.reachableSource(plain, {}), true);

  // quest and unmodelled are not switches -- no option brings them back
  for (const access of ["quest", "unmodelled"]) {
    assert.equal(ROT.reachableSource({ ...plain, access }, ON), false,
                 `${access} is not something a checkbox can reach`);
  }
});

test("the two opt-ins each gate their own kind of source, and only their own", () => {
  const ROT = loadRotation();
  const rj = { planet: "Veil Proxima", node: "Flexa", mode: "Caches" };
  const ev = { planet: "Event: Saturn", node: "Aegaeon", mode: "Spy" };

  assert.equal(ROT.isRailjack(rj), true, "subject check: this must be a Railjack node");
  assert.equal(ROT.isEventNode(ev), true, "subject check: this must be an event node");

  assert.equal(ROT.reachableSource(rj, { railjack: false, event: false }), false);
  assert.equal(ROT.reachableSource(rj, { railjack: true, event: false }), true);
  assert.equal(ROT.reachableSource(rj, { railjack: false, event: true }), false,
               "the event box must not let a Railjack node through");

  assert.equal(ROT.reachableSource(ev, { railjack: false, event: false }), false);
  assert.equal(ROT.reachableSource(ev, { railjack: false, event: true }), true);
  assert.equal(ROT.reachableSource(ev, { railjack: true, event: false }), false,
               "the Railjack box must not let an event node through");
});
