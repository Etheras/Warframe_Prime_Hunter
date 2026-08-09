# VorFrame — visual style

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

Rarity uses the game's own bronze/silver/gold language, so it reads without a
legend. Never tint a background by rarity *and* put rarity chips on it — that
was the first attempt and the chips vanished into the gradient.

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
  at the end of the file silently overrode a new rule and cost real time.

---

## 8. Verifying

The browser caches `styles.css` aggressively. If a change appears not to apply,
bust the cache before assuming the CSS is wrong:

```js
document.querySelector('link[rel=stylesheet]').href = 'assets/styles.css?v=' + Date.now();
```

Then check the computed style, not the screenshot — a screenshot cannot tell you
whether a rule applied or merely looks similar.
