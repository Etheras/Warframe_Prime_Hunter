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
function sandbox({ data = {}, now = Date.parse("2026-08-11T21:00:00Z"), seed = null } = {}) {
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

test("AABC: a reset run stops at the last rotation worth anything", () => {
  const ROT = loadRotation();
  const onlyA = ROT.runValue({ A: 1, B: 0, C: 0, none: 0 }, "reset", "Defense", false, null);
  assert.equal(onlyA.rounds, 2, "rounds 1-2 both pay A, so stop at 2");
  assert.deepEqual(plain(onlyA.counts), { A: 2 });

  const alsoC = ROT.runValue({ A: 1, B: 0, C: 1, none: 0 }, "reset", "Defense", false, null);
  assert.equal(alsoC.rounds, 4, "leaving after A never yields the C part");
  assert.deepEqual(plain(alsoC.counts), { A: 2, B: 1, C: 1 });
});

test("AABC: a full run banks one whole cycle, aabcaa banks six rounds", () => {
  const ROT = loadRotation();
  const rot = { A: 1, B: 1, C: 1, none: 0 };
  assert.equal(ROT.runValue(rot, "full", "Defense", false, null).total, 4);
  assert.equal(ROT.runValue(rot, "aabcaa", "Defense", false, null).total, 6);
});

test("a node with no rotation is added flat, once per run", () => {
  const ROT = loadRotation();
  const flat = ROT.runValue({ A: 0, B: 0, C: 0, none: 0.5 }, "reset", "Capture", false, null);
  assert.equal(flat.total, 0.5);
  assert.equal(flat.rounds, null);
});

test("Disruption does not use the AABC cycle, and rotation A needs a squad", () => {
  const ROT = loadRotation();
  const wantA = { A: 1, B: 0, C: 0, none: 0 };
  const solo = ROT.runValue(wantA, "reset", "Disruption", false, null);
  assert.equal(solo.total, 0, "defending all four conduits can never reach rotation A");
  assert.ok(solo.stranded.includes("A"));

  const squad = ROT.runValue(wantA, "reset", "Disruption", true, null);
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
  const worth = { A: 1, B: 0, C: 0.2, none: 0 };
  const chance = { A: 0.1, B: 0.5, C: 0.5, none: 0 };
  const r = ROT.runValue(worth, "reset", "Defense", false, null, chance);

  assert.deepEqual(plain(r.counts), { A: 2, B: 1, C: 1 },
                   "reset runs to C, because a C relic is wanted");
  // 2 x 0.1 + 1 x 0.5 + 1 x 0.5 - rotation B counts even though it is worth
  // nothing, because the run passes through it and you keep what it hands you
  assert.ok(Math.abs(r.count - 1.2) < 1e-12, "expected wanted relics, got " + r.count);
  // 1 - (0.9^2 x 0.5 x 0.5)
  assert.ok(Math.abs(r.any - 0.7975) < 1e-12, "P(at least one), got " + r.any);
});

test("counting is skipped entirely when nothing asks for it", () => {
  const ROT = loadRotation();
  const r = ROT.runValue({ A: 1, B: 0, C: 0, none: 0 }, "reset", "Defense", false, null);
  assert.equal(r.count, undefined, "no alt map, no count - not a silent zero");
  assert.equal(r.any, undefined);
});

test("a chance over 100% across one table is held at certainty", () => {
  const ROT = loadRotation();
  // several wanted relics in one table can sum past 1; one roll cannot pay twice
  const r = ROT.runValue({ A: 1, B: 0, C: 0, none: 0 }, "reset", "Defense", false, null,
                         { A: 1.4, B: 0, C: 0, none: 0 });
  assert.equal(r.count, 2, "two rolls at certainty, never 2.8");
  assert.equal(r.any, 1);
});

test("a flat node counts its single roll, and no rounds", () => {
  const ROT = loadRotation();
  const r = ROT.runValue({ A: 0, B: 0, C: 0, none: 0.5 }, "reset", "Capture", false, null,
                         { A: 0, B: 0, C: 0, none: 0.25 });
  assert.equal(r.count, 0.25);
  assert.equal(r.any, 0.25);
});

test("a run is costed in objectives, and each type has its own word for one", () => {
  const ROT = loadRotation();
  const o = (n) => plain(ROT.objectivesOf(n));
  assert.deepEqual(o({ mode: "Defense", rounds: 4 }), { count: 4, unit: "round" });
  assert.deepEqual(o({ mode: "Spy", rounds: 3 }), { count: 3, unit: "vault" },
                   "a Spy rotation IS the vault count, so the rounds are the objectives");
  assert.deepEqual(o({ mode: "Caches", rounds: 2 }), { count: 2, unit: "cache" });
  assert.deepEqual(o({ mode: "Capture", rounds: null }), { count: 1, unit: "run" },
                   "nothing to count inside a single-reward mission");
  assert.deepEqual(o({ mode: "Bounty", rounds: null, bounty: { letter: "A" } }),
                   { count: 4, unit: "stage" },
                   "a bounty is not on the round cycle, so it is costed in stages");
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
    const run = ROT.runValue({ A: 1, B: 1, C: 1 }, "reset", "Bounty", false, live, null);
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
  const r = ROT.runValue({ A: 5, B: 3, C: 1, none: 0 }, "reset", "Bounty", false, live);
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
  const r = ROT.runValue({ A: 4, B: 2, C: 0, none: 0 }, "reset", "Bounty", false, live);
  assert.equal(r.total, 3, "the mean of what it does publish");
  assert.equal(r.bounty.letter, null);
  assert.equal(r.bounty.offTable, true);
  assert.equal(r.bounty.live, "C", "and remembers what the board is on");
});

test("a single-table bounty has nothing to wait for", () => {
  const ROT = loadRotation({ data: BOUNTY_DATA });
  const live = ROT.liveRotation("Level 15 - 25 Plague Star");   // not in groups at all
  const r = ROT.runValue({ A: 2, B: 0, C: 0, none: 0 }, "reset", "Bounty", false, live);
  assert.equal(r.total, 2);
  assert.equal(r.bounty.unknown, false, "one table is not an unknown rotation");
});

test("with no bounty data at all the letter is unknown, never guessed", () => {
  const ROT = loadRotation({ data: { meta: {}, relics: {} } });
  const live = ROT.liveRotation("Level 5 - 15 Cetus Bounty");
  assert.equal(live.letter, null);
  const r = ROT.runValue({ A: 4, B: 2, C: 0, none: 0 }, "reset", "Bounty", false, live);
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

test("staying for the fissure bonus is a fourth run mode, five rotations deep", () => {
  const ROT = loadRotation();
  /* The other three stop at four rotations or six. An endless Void Fissure pays
     a free Exceptional relic at five, so the first bonus is either unreachable
     or a coincidence unless the run is chosen for it. */
  assert.ok(ROT.RUN_MODES.includes("bonus"));
  assert.equal(ROT.bonusRotations, 5);

  const rot = { A: 1, B: 1, C: 1, none: 0 };
  const at = (mode) => ROT.runValue(rot, mode, "Defense", false, null).rounds;
  assert.equal(at("full"), 4, "one whole cycle, and short of the bonus");
  assert.equal(at("bonus"), 5, "exactly the depth the bonus is paid at");
  assert.equal(at("aabcaa"), 6);

  // AABCA over five rounds - the fifth is a second lap of rotation A
  assert.deepEqual(plain(ROT.runValue(rot, "bonus", "Defense", false, null).counts),
                   { A: 3, B: 1, C: 1 });

  // a mission with no rotation cannot stay for anything, so it gets no rounds
  assert.equal(ROT.runValue({ A: 0, B: 0, C: 0, none: 0.5 },
                            "bonus", "Capture", false, null).rounds, null);
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
  const F = (o) => Object.assign(
    { node: "?", tier: "Lith", mode: "Defense", hard: false, storm: false }, o);

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
