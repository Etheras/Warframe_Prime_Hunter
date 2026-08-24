# Warframe Prime Hunter — visual style

The rules a new page follows so it looks like it belongs. **Read this before
adding any UI**, and update it whenever a genuinely new pattern is introduced —
"make it like the other page" stops being actionable once there are more than two.

Every rule here exists because something concrete went wrong; the reason is given
so you can tell when a rule does *not* apply.

---

## 1. Colour carries one meaning at a time

Two independent things need colour, and they must never use the same channel:

| Channel | Encodes | Palette |
|---|---|---|
| **Row background** | the **action** — what refinement to take this relic to | Intact green · Exceptional teal · Flawless blue · Radiant violet |
| **Chip / label** | the **rarity** of a specific reward | Common bronze `#c67836` · Uncommon silver `#ced6e2` · Rare gold `#ffce40` |
| **Badge beside a node name** | what the node **demands of you** before you can play it | `--blue`, outlined, uppercase |

Rarity uses the game's own bronze/silver/gold language, so it reads without a
legend. Never tint a background by rarity *and* put rarity chips on it — that
was the first attempt and the chips vanished into the gradient.

The third channel is `.demand`: `Railjack`, `PvPvE`, `Old Mate` (Solaris United
Rank 5, for the Profit-Taker phases), `Steel Path`, and `Enemy`. It states a
**requirement, not a verdict**: all of them are perfectly good farms and none is
penalised in the ranking, so it must never borrow the amber or red that mean
"something here is wrong". A node called "Arva Vector" gives no hint that it needs
a ship and a crew, and one called "Vehrvod District" none that you will be matched
against another squad — finding that out inside the mission is the wrong moment.
Every badge carries a tooltip naming the demand; without one it is just a word in
a box.

**`Enemy` is the odd one and is worth watching.** It rides the same channel while
saying something different in kind — not *what this place asks of you* but *this
is not a place*: the Hemocyte spawns where it spawns, and the relics come off its
body. It is one badge on one row (the only relic-dropping enemy DE publishes), so
it does not yet justify a fourth channel. If a second disclaimer-shaped badge ever
appears, that is the moment to split them, because a channel that carries two
meanings is exactly what this section exists to prevent.

The **same blue** carries the same requirement at item scale: a card whose every
farmable relic drops on Railjack says `RAILJACK ONLY`, in place of the `P · NEVER
VAULTED` teal it would otherwise wear. Two badges, one colour, one meaning —
*you will need a ship*. Choosing a different colour for the card would have made
them look like two unrelated facts.

**A rule that does not apply everywhere gets `--odd` amber** (`#684321`).
Used on the rotation label of mission types that break the A→A→B→C cycle — currently
only Disruption. It means "this one works differently, hover me", not "warning" and
not a rarity. Anything given this colour must carry a tooltip explaining the
difference, or the colour is just noise.

The same amber marks **a number the app supplied because you did not** (`.est`): the
assumed minutes on a planner row, where a mission type carries no effort weight of
its own and is costed at the average of the ones that do. Same meaning — this one is
not like its neighbours — and the same obligation to explain itself. A borrowed
number that looks identical to one you typed is precisely what it prevents.

It sits at the **same brightness as the meta line it lives on** — hue carries the
signal, not luminance. A first attempt used a bright `#e8944a` at 7.27:1, which read
as a highlight rather than as an annotation and made the row look like it had an
error in it. Matching the surrounding text and changing only the hue is the quieter
and more accurate signal. Note this puts it below the §3 contrast floor, which the
whole meta line already is — see `TODO.md`.

**The data banner is deliberately the loudest thing on the page.** Solid amber for
"behind", solid red for "incomplete" — not a tinted panel with a coloured edge, which
is what it was first and which read as decoration and got scrolled past. It is the one
element allowed to shout, because it only appears when what you are looking at cannot
be trusted.

**Write for whoever is actually reading.** The same banner is seen by the person who
runs the server and by anyone they shared the address with. Only the first can fix
anything, so only they are told how — and in their terms, the file they double-click,
never a command line. Everyone else gets the warning and nothing they cannot act on.

**Vaulted / unobtainable fades to violet** (`rgba(157,123,234,…)`), matching the
Resurgence badge, because Prime Resurgence is how vaulted things come back. This
is our convention, not a Digital Extremes palette — none is published.

---

## 2. Gradients

- **Sized in percentages, never pixels.** A fixed `1100px 700px` page wash landed
  differently on every screen and showed through panels with no background.
- **Hold the colour, then ease out**: solid to ~38%, transparent by ~76%. A smooth
  full-width fade reads as a rendering artefact rather than a deliberate cue.
- Anything sitting on a gradient needs an **opaque background of its own**. A
  translucent chip on a gradient disappears — this happened twice, first with the
  "vaulted" state chip and again with the wanted-part list.

---

## 3. Contrast

Text on a tinted row must clear **WCAG AAA (7:1)** against *its own* background,
not against the page. Measure it rather than eyeballing:

```js
// in the console, on the element in question
const cs = getComputedStyle(el); [cs.color, cs.backgroundColor]
```

**Measure the element, never the token** — a token can carry an alpha, and then
the colour that reaches the eye is a blend with whatever is behind it. This is
not hypothetical: `--txt-faint` is `#66708090`, and reading it as `#667080` put
the meta line's contrast in `TODO.md` at **3.48:1** for four days when the real
figure is **1.97:1**. The line above returns `rgba(...)` with the alpha included,
which is exactly why it is the instruction rather than "look up the hex".

The state chips run 8.3:1 and 10.2:1. Anything visibly below that is a bug.

---

## 4. Tooltips

- Use the **custom monospaced tooltip** (`data-tip="…"`), never native `title=`.
  Native tooltips are proportional, which ruins aligned columns — the refinement
  odds table was unreadable through one.
- **Tooltips explain, they never repeat.** A tooltip on a chip that says "Rare"
  reading *"Rare is what you are blocked on"* is noise. Put a tooltip where the
  reasoning is invisible: why this refinement, what a rotation letter means, what
  is in a collapsed list.
- Anything hoverable is **dotted-underlined** (`abbr.rot`, `.relic-count`,
  `.more`) or carries `cursor:help`. Never advertise a tooltip that is not there
  — a `cursor:help` left behind after its `title` was removed is a bug.

---

## 5. Density

- **Long lists condense to a count, with the full list on hover.** Relic lists,
  source lists, wanted-part lists. Wrapping them pushes rows apart and makes a
  table impossible to scan.
- Sources and parts belonging to a row go **on a line beneath it**, indented and
  dimmed — not inline, which turns every row into a different height.
- **Explanation goes at the foot of the page, collapsed** — never between a
  heading and its data. A paragraph explaining how a ranking works is read once
  and then costs a screenful forever. Put it under a `How this works` summary at
  the bottom and let the data start immediately.
- **Chips carry their own colour, so what sits behind them does not.** The line
  holding a set of chips is plain; tinting it as well is the one-meaning-per-
  channel rule broken in a second place.
- **Weight is not a signal.** Do not bold one chip among several to mark it —
  differing weights in a row read as a rendering fault. Use a border or an inset
  ring instead.
- **Order it rather than mark it.** If a set has a natural ranking, sort by it and
  let position carry the meaning — do not highlight the top one. A highlight has
  to pick a single winner even when two items are genuinely equal, and that pick
  is arbitrary: two equally-scarce parts had one ringed purely because it came
  first in the list. Sorting has no such failure mode, needs no legend, and
  survives ties. Wanted parts sort rarest first, gold to bronze, left to right.
- **A list that ranks on something says so in its heading.** *Where to go —
  ranked on relics per objective*, *How to crack them — ranked on openings per
  part cleared*. Two lists side by side, each with one large unexplained number, is
  the confusion that splitting them was meant to end; the headings are what
  stops the split from just moving it.
- **The biggest number in a row is the one the row is sorted by.** Everything
  derived from it goes underneath it in the same corner, smaller and dimmer
  (`.spot-alt`). A mockup promoted an average relic count over the ranked
  percentage and the list immediately looked unordered — two numbers of equal
  weight give the reader no way to tell which one produced the order they are
  looking at. It follows that when the ranking changes what it measures, the big
  number changes with it and its label says so: "per run" becomes "per minute"
  the moment effort weights are given.
- **Pad a block on both sides.** A line with padding on the bottom and none on
  the top reads as misaligned even when the spacing above comes from a
  neighbour's margin.
- Inline chips need horizontal room. In a column narrower than ~300px use **full
  width rows** instead; chips wrapped raggedly in the 290px planner sidebar and
  read as broken form controls.

---

## 6. Controls

- A **tick** marks ownership (top-right of a card). A **crosshair** marks intent
  to farm (top-left). Green means owned, teal means queued.
- Numbers that change during play are **directly editable**; names and targets sit
  behind an **edit** toggle so a stray click cannot disturb them.
- Strip native spinners from number inputs (`appearance:textfield` plus the
  `::-webkit-*-spin-button` reset). They are visually noisy at this size.
- Default-off options that need explaining live under **Advanced options** with
  the reasoning in a tooltip, not in surrounding prose.
- **A control must not rebuild the container it lives in.** `innerHTML` destroys
  the element that had the focus, so `document.activeElement` falls back to
  `<body>` and the keyboard user is returned to the top of the page. The part
  counters in the drawer did exactly that: the scroll position was carefully
  saved and restored, and the focus was not, so banking three parts meant tabbing
  in from the top three times. Update the control and its neighbours in place;
  rebuild only sections that genuinely changed and do not hold the focus — for
  that one it is `#dSpots`, the farm-spot ranking, which really does re-rank.
- **Ask in the unit that holds still.** Effort is collected per *objective* — a
  Defense round, a Spy vault, a bounty stage — never per run, because how far you
  take an endless mission is your own choice and the option directly above it
  changes that. A question whose unit moves cannot be answered once.
- **Only offer a control for something in front of you.** The effort panel lists
  the mission types the current plan actually ranks, not all 31 in the data.
  Those rows stay alphabetical rather than following the ranking they alter: a
  form whose fields rearrange themselves while you are typing into one is
  unusable, however informative the new order would be.

---

## 7. Layout

- **Peer views get a segmented control, not a link.** `index.html` and `plan.html`
  are two views of one dataset, so both carry the same `.viewtabs` pair with the
  current one marked `.on` — gold text on `--panel-2` with an inset ring. A one-way
  ghost button sat among the utility buttons and read as "somewhere else you can
  go" rather than "the other half of this app". The brand block stays identical
  across views; only the sub-line changes, because the tabs already say where you
  are.
- **Inactive nav text is `#9ca7b9`, not `--txt-dim`.** `--txt-dim` on `--panel`
  measures 6.68:1 — under the 7:1 in §3. It passes elsewhere on lighter
  backgrounds; on the top bar it does not, so nav sets its own value at 7.17:1.
- Sidebars use a **solid** background, not a gradient. One that faded out after
  340px left the rest of a scrolling column unpainted.
- Sections that sit on the page wash get **their own panel** (`--panel`, 1px
  `--line-soft`, 9px radius) so the background cannot bleed through.
- Section headings: 11px, uppercase, 1.3px letter-spacing, `--txt-faint`.
- Both pages share `assets/styles.css`. Page-specific rules are scoped by a body
  or container class, and **appended rules win by cascade order** — check for an
  existing rule for the same selector before adding one, since a stale duplicate
  at the end of the file silently overrode a new rule and cost real time. It has
  since happened again, and not at the end of the file: `.spot-score b` was
  declared at 17px and again at 16px on the very next line, so the first was dead
  from the moment it was written and nobody noticed for weeks. Grep the selector.
  Do not scroll to where you believe it lives.

---

## 8. Verifying

The browser caches `styles.css` aggressively. If a change appears not to apply,
bust the cache before assuming the CSS is wrong:

```js
document.querySelector('link[rel=stylesheet]').href = 'assets/styles.css?v=' + Date.now();
```

Then check the computed style, not the screenshot — a screenshot cannot tell you
whether a rule applied or merely looks similar.
