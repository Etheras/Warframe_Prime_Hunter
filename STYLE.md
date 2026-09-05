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
farmable relic drops on Railjack says `RAILJACK ONLY`, in place of the `NEVER
VAULTED` teal it would otherwise wear. Two badges, one colour, one meaning —
*you will need a ship*. Choosing a different colour for the card would have made
them look like two unrelated facts.

**A badge that says "sometimes" must not look like one that says "now."** Added
2026-09-04, from the owner looking at five vaulted secondaries all wearing a
blue `BARO` while Baro was on a relay selling a relic for exactly one of them —
*"why are there so many Baro items, although they are not available from Baro?"*
The flag behind it is the wiki's marker for **"he has sold this before"**, which
is true of nine Primes and true of today for almost none of them.

So there are two badges. `BARO — HERE NOW` keeps `--blue`, the colour Baro
already owns on both pages, and is shown only when his live manifest holds a
relic for that Prime **and** the page's own clock puts him on a relay. `BARO —
MAYBE` takes `--txt-dim`, the same grey as `VAULTED`, because it sits beside
`VAULTED` and says the same kind of thing: *not a route you can take now*.

**Both carry the same stem on purpose** — it was `BARO SOMETIMES` until
2026-09-05, and matching the em-dash shape makes them read as one question
answered two ways rather than as two unrelated badges. And **the badge is where
the live answer lives**: the availability boxes beside the grid say what a Prime
*is* and do not move when his van does, so the card is the only thing that
changes across his arrival. `PROJECT.md §7` has why a third checkbox for it was
rejected.

The general rule, which is the part worth keeping: **colour is for what the
reader can act on.** A marker about history wearing the colour of a live
opportunity is a wrong claim made in the one channel a reader takes in without
reading — and the measurement says how wrong: 271 of his 313 recorded visits
carried no relic at all.

**A rule that does not apply everywhere gets `--odd` amber** (`#e4bf9a`).
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
and more accurate signal.

That rule is why `--odd` has moved three times and never on its own account:
`#684321` → `#d29455` when the meta line went to `--txt-dim`, then `#d29455` →
`#d69f66` and `#d69f66` → `#e4bf9a` as `--txt-dim` was raised twice on 2026-08-25.
**It tracks the line by ratio rather than holding a value** — 10.14:1 against
`--panel` where `--txt-dim` is 10.13:1, a gap of 0.003. Anyone changing
`--txt-dim` has to move this with it, or the amber starts reading as a highlight
again. It used to sit below the §3 floor and this paragraph said so; it does not
any more.

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
the colour that reaches the eye is a blend with whatever is behind it. This is not
hypothetical: `--txt-faint` used to be `#66708090`, and reading it as `#667080`
put the meta line's contrast in `TODO.md` at **3.48:1** for four days when the
composited figure was **1.97:1**. No token carries an alpha today — that one was
made opaque on 2026-08-25 precisely so it could not lie again — but the
instruction stands, because the next one to be added will.

The state chips run 8.3:1 and 10.2:1. Anything visibly below that is a bug.

### Where the tokens actually stand

**Every text colour in the app clears AAA, as of 2026-08-25.** Audited on both
rendered pages — every element carrying text, each measured against the surface
behind it rather than against the page. `index.html` has 20 colour-on-background
pairs and `plan.html` 21, with the ranked rows populated; **none is below 7:1**,
and the lowest is 7.00.

| Token | Worst surface | Ratio | Was |
|---|---|---|---|
| `--txt` `#e6ebf2` | `--panel-2` | 13.67:1 | unchanged |
| `--txt-dim` `#bfc6d1` | `--panel-2` | 9.52:1 | `#96a1b3`, 6.27:1 |
| `--txt-faint` `#a4aab3` | `--panel-2` | 7.00:1 | `#66708090`, **1.92:1** |
| `--odd` `#e4bf9a` | `--panel` | 10.14:1 | `#684321`, then `#d29455` |
| `--violet` `#b49aef` | badge fill | 7.02:1 | `#9d7bea`, 5.14:1 |
| `--blue` `#65afe8` | badge fill | 7.02:1 | `#5aa9e6`, 6.55:1 |
| `--red` `#e7899a` | `--panel` | 7.01:1 | `#e0637a`, 5.17:1 |
| `--gold` · `--teal` · `--green` | — | 8.29 · 7.48 · 8.35 | already passed |

Three rules came out of doing it, and each cost something to learn.

**Solve on the rounded value.** A float that clears 7:1 can round to a hex that
does not — `#a0aaba` was an intermediate answer for `--txt-dim` and measures
6.98:1 on `--panel-2`.

**Solve against every surface, not the one in front of you.** `--txt-dim` at
`#96a1b3` cleared the floor on the dark surfaces and missed it on the light ones,
so whether the rule held depended on which row you happened to look at.

**Drop alpha rather than tune it.** `--txt-faint` was `#66708090` — a mid grey at
56% opacity. The bare hex reads 3.48:1 and the composited truth was 1.92:1, and
that gap is exactly why the instruction above is *measure the element*. It is
opaque now, which is one less thing the stylesheet cannot be reasoned about.

**The hierarchy is carried by separation, not by illegibility.** The three levels
sit 1.47× and 1.41× apart in luminance. Raising `--txt-faint` alone would have
landed it within a hair of `--txt-dim`'s own minimum and collapsed three levels
into two, so `--txt-dim` was pushed to 9.5:1 rather than to its floor.

`--odd` tracks `--txt-dim` by ratio rather than by target, per §1 — 10.14:1
against 10.13:1.

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
  ranked on relics per reward*, *How to crack them — ranked on openings per
  part cleared*. Two lists side by side, each with one large unexplained number, is
  the confusion that splitting them was meant to end; the headings are what
  stops the split from just moving it.
- **And if the reader can change what it ranks on, the control goes on that
  heading's line** — right-aligned, small, quiet. It began in the sidebar with
  the assumptions and that was the wrong shelf: everything else there is
  something the *model* needs to be told, while this only reorders the list in
  front of you. A control and the thing it reorders should be able to see each
  other. The heading still carries the sentence; the control carries the choice,
  and the two must never disagree — when one says *per minute* so does the other.
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

**A condensed list needs a way out of itself.** The count-with-detail-on-hover
rule above is right for the default and wrong as the only option. The planner's
ranking showed its top eight and put the next twenty in a tooltip, which cannot
be scrolled, sorted or searched — and past twenty-eight there was no way to see a
place at all.

That hid three separate results the project had measured and believed: Spy nodes
reach no top eight on any item, and neither do the eleven that hand relics over
Radiant. All three were correct and unobservable, and three page tests were
deleted for having no subject on screen before anyone noticed the pattern.

So: **eight stays the default, and the count becomes a control rather than a
hover.** *Show all 92 places* expands in place — one list, one ranking, no new
page, and the order does not change. A tooltip may summarise what is behind a
condensed view; it must not be the only route to it.

## 6. Controls

- A **tick** marks ownership (top-right of a card). A **crosshair** marks intent
  to farm (top-left). Green means owned, teal means queued.
- Numbers that change during play are **directly editable**; names and targets sit
  behind an **edit** toggle so a stray click cannot disturb them.
- Strip native spinners from number inputs (`appearance:textfield` plus the
  `::-webkit-*-spin-button` reset). They are visually noisy at this size.
- Default-off options that need explaining live under **Advanced options** with
  the reasoning in a tooltip, not in surrounding prose.
- **Where the real icon cannot be had, no icon beats a lookalike.** The Mastery
  Rank field shipped with a drawn sigil because DE's own rank art is unreachable —
  the wiki 403s non-browsers and the item CDN carries none of it — and it was cut
  the next day. It was spending width in the header to carry a tier the rank title
  already states in words, and a substitute for a recognisable icon is not
  recognisable; it is just a shape. Ask what the icon is *for* before drawing a
  replacement.
- **Letters that qualify a number go beside the field, not inside it.** `MR` is a
  label next to the rank box rather than part of its value, which is what lets the
  box be typed into — and what lets the label become `LR` past rank 30 while the
  stored value stays one integer. A field whose text you must retype to change its
  units is a field nobody edits twice.
- **A control that names its own ends needs no paragraph explaining them.** The
  Void Trace switch is labelled *room to spare* / *at the cap*; a line beneath it saying
  *"At MR 9 your Void Trace cap is 550 — 5 Radiants at 100 traces each"* was
  restating the control it sat under, and it went the day it shipped. Where a
  derived fact genuinely belongs is with **the thing it is derived from** — the
  cap moved to the Mastery Rank field's tooltip, because a cap is a property of
  the rank and that field is where a reader asks what their rank means.
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

**A checkbox for *include this*, a switch for *which of two*.** Four of the
planner's assumptions are include-X questions and a tick reads correctly as "yes,
count it". *Capped Void Traces* is not that shape — it asks which of two ordinary
situations you are in, and neither is a fault. That gets a pill switch, and
**both ends are labelled**: `room to spare` and `at the cap` sit either side of
the track, the knob says which one is chosen, and the live end is the bright one.
Nothing depends on reading a colour.

**Off is the left end and on is the right, the usual way round.** This said the
opposite until 2026-09-05: the switch used to ask *Short on Void Traces?* with
`under 500` on the **left** as the *on* state, reversing the convention, and the
note here defended that as safe because both ends carry a word. It was safe, and
it stopped being worth it the moment the question changed — the switch now reads
as a plain on/off pill ("capped: yes or no"), so it behaves like one. The older
rule still holds where it applies: a reversed knob is only ever defensible on a
switch whose ends are labelled, never on a bare track.

Gold, like every other control here, so it borrows no new meaning. Gold marks
*this toggle is on*, which is a state and not an approval — here it means "you
are at the cap", which is neither good nor bad. A reference sketch used teal and
red; §1 reserves red for *something here is wrong*, and being capped is not an
error.

**Do not spread the switch to the include-X boxes.** One control shape per kind of
question is the point; two shapes chosen at random is what this section exists to
prevent.

**A worked example of that rule, added 2026-09-01.** *How to crack them* carries
two kinds of narrowing at once and they take two shapes. Which relic **tier** to
show is a choice between four, so it is a strip of tabs with the chosen one gold.
Whether to include an **errand** — Varzia's shelf, or the relics only a trade can
get — is an include-X question each time, so each is a `.mini-check`. Putting the
errands into the tab strip would have read as five tiers, one of which is a
person.

Both obey *only offer a control for something in front of you*: a tier with no
relics gets no tab, and an errand nobody's list has gets no box.

**The counts are what make them worth reading — `Lith 10`, `Trade 717` — and the
rule for them took two goes.** A facet's count **ignores its own control and
obeys every other one**. Counting the whole list regardless is the obvious first
answer and it is wrong: unticking `Trade 717` left the tier tabs claiming 195
Lith relics over a list holding ten. Counting only what is currently shown is the
obvious second answer and it is also wrong: a tab would report on itself, so
`Lith` would read the same number whatever else you pressed.

Two corollaries, and they are what keep the strip still under the reader's hand:

- **What a control counts and whether it exists are separate questions.** The set
  of controls comes from the unfiltered list, so pressing one never makes another
  appear or vanish. A tier emptied by a checkbox reads `0` and greys out.
- **Never disable the control that is currently chosen**, however empty it has
  become — that is the reader's way back, and greying it out strands them in
  front of an empty list with no explanation they can act on.

**A control on a heading's line must let that line wrap.** The strip is about
500px; in the planner's own column, a `.plan-head` that could not wrap squeezed
the heading to zero width and spilled its text down the page while the strip
overflowed sideways. It does not show at desktop width, which is exactly why it
is written down here.

**Verifying one of these is awkward and worth knowing about.** A switch is mostly
CSS transitions, and the Browser pane does not composite a hidden tab — so
`getComputedStyle` returns a colour frozen part-way through the transition, no
matter how long you wait. Assert on `element.matches(selector)` for each state
instead: that reads the cascade rather than the animation, and it is what the
rule actually says.

---

## 7. Layout

- **Peer views get a segmented control, not a link.** `index.html` and `plan.html`
  are two views of one dataset, so both carry the same `.viewtabs` pair with the
  current one marked `.on` — gold text on `--panel-2` with an inset ring. A one-way
  ghost button sat among the utility buttons and read as "somewhere else you can
  go" rather than "the other half of this app". The brand block stays identical
  across views; only the sub-line changes, because the tabs already say where you
  are.
- **Inactive nav text is `--txt-dim`.** It was `#9ca7b9` at 7.17:1, and this rule
  said so until 2026-08-26 — chosen only because `--txt-dim` measured 6.68:1 on
  `--panel` and missed the §3 floor. `--txt-dim` was re-solved to `#bfc6d1` and now
  clears 7:1 on every surface in the app, so the magic number has no job left and
  the token does it instead. **A hardcoded colour that exists to dodge a token is
  a debt against that token**, and it comes due silently: the CSS had already been
  changed and this line had not.
- **The centre of a bar is the centre of the bar, not of what is left over.** The
  search sits in the middle track of `grid-template-columns:minmax(0,1fr) auto
  minmax(0,1fr)`, so the two side tracks are equal by construction and the middle
  one is genuinely centred. It was a flex child with `flex:1`, which centres it in
  the space its neighbours happen to leave — measured 57px right of centre once
  the Mastery Rank field was added to the left. Anything that must line up with
  the page rather than with its siblings wants a track of its own, not `flex:1`.
- **A footer carries what belongs to the site, not to a page.** Attribution,
  privacy and licensing sit in one `.sitefoot` across the foot of both pages,
  rendered from a single place in `shared.js`. They used to live inside the
  collection sidebar's data note, which put them on one page of two. Small and
  quiet — 10.5px — but see §3: the contrast floor is not what "quiet" is spent on.
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

**`tools/serve.py` sends `Cache-Control: no-store` on every response**, as of
2026-08-25, so an edit is live on the next reload and the incantation that used
to live here is no longer needed. It sent `Last-Modified` and nothing else, which
let browsers apply heuristic freshness and serve a stale `styles.css` or
`rotation.js` without revalidating — the cause of more than one long hunt for a
change that had in fact applied.

If a change still appears not to have taken, the cache is no longer the first
suspect. Check that the server is the one you think — `serve.py` on 8777, not
`vorframe-plain` on 8781, which sends no such header — and that the tab has been
reloaded since the edit. A tab that cached a file *before* this change will keep
it until forced, since `no-store` only governs responses it was sent with:

```js
// only for an entry cached before 2026-08-25; forces a fresh copy into the cache
await fetch('assets/styles.css', { cache: 'reload' });
```

Then check the computed style, not the screenshot — a screenshot cannot tell you
whether a rule applied or merely looks similar.
