/* VorFrame's browser-side tests.
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
function sandbox({ data = {}, now = Date.parse("2026-08-11T21:00:00Z") } = {}) {
  const FixedDate = class extends Date {
    static now() { return now; }
  };
  const el = () => ({
    style: {}, classList: { add() {}, toggle() {} }, dataset: {},
    appendChild() {}, addEventListener() {}, hidden: false, className: "",
  });
  const store = new Map();
  const ctx = {
    window: { VORFRAME_DATA: data, addEventListener() {} },
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
  return ctx.window.VorFrameRotation;
};
const loadShared = (opts) => {
  const ctx = sandbox(opts);
  vm.runInContext(source("shared.js"), ctx);
  return { S: ctx.window.VorFrameShared, ctx };
};

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
      groups: {
        "Level 5 - 15 Cetus Bounty": { family: "standard", rotations: "ABC" },
        "Level 30 - 40 Cambion Drift Bounty": { family: "standard", rotations: "AB" },
        "Level 30 - 40 Isolation Vault": { family: "vault", rotations: "ABC" },
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
  assert.equal(ROT.stamp(), "CB", "families sorted: standard, then vault");
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
  const live = ROT.liveRotation("Level 30 - 40 Cambion Drift Bounty");  // board on C, table AB
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
  assert.deepEqual(plain(demands("Faceoff: Squad VS Squad (Steel Path)")), ["PvPvE"]);
  assert.deepEqual(plain(demands("Ukko", { planet: "Void" })), [],
                   "an ordinary node demands nothing and says nothing");
  // the regex once contained a literal backspace instead of a word boundary,
  // which matched nothing at all and failed silently
  assert.equal(ROT.isPvPvE({ node: "Faceoff: Single Squad" }), true);
  assert.equal(ROT.isPvPvE({ node: "Facsimile" }), false);
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
    collected: "vorframe.collected.v1",
    parts: "vorframe.parts.v1",
    materials: "vorframe.materials.v1",
    wishlist: "vorframe.wishlist.v1",
    plan: "vorframe.plan.v1",
    filters: "vorframe.filters.v1",
  }, "renaming one of these silently orphans saved progress");
});

test("load falls back rather than throwing on a corrupt store", () => {
  const { S, ctx } = loadShared();
  S.save(S.KEYS.parts, { "warframe-xaku-prime": { Chassis: 1 } });
  assert.deepEqual(plain(S.load(S.KEYS.parts, {})), { "warframe-xaku-prime": { Chassis: 1 } });
  assert.deepEqual(S.load("vorframe.nothing.here", "fallback"), "fallback");
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
