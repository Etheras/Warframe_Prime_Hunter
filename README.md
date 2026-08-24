# Warframe Prime Hunter

> ### Written by a generative AI
>
> **Effectively all of this project — code, tests and documentation — was written
> by [Claude](https://www.anthropic.com/claude) (Anthropic), working from a human
> owner's direction, review and decisions.** It is not a human-authored codebase
> that an assistant helped with; it is the other way round.
>
> Read it with that in mind. What follows is what the project actually does about
> it, rather than a disclaimer that ends the sentence:
>
> - **Everything is checked by running it.** 316 automated tests, including
>   browser tests against the real pages, and the reasoning behind each design
>   decision is written down in [`PROJECT.md`](PROJECT.md) rather than left in a
>   chat log. Where a rule exists, the incident that caused it is recorded.
> - **No language model is in the data pipeline.** Nothing you see is generated,
>   guessed or summarised at runtime. Every number comes from Digital Extremes'
>   published drop tables and item manifest, parsed deterministically — see
>   [`PROJECT.md §2`](PROJECT.md). An AI wrote the parser; it does not run inside
>   it.
> - **It has been wrong.** Real bugs shipped and were caught later: a regex that
>   silently matched nothing, a badge that told six Primes they were "never
>   vaulted" when they need a Railjack, a farm list that came back empty with no
>   explanation. Each is written up in the git history and in
>   [`TODO.md`](TODO.md). Assume more remain.
> - **Nothing here is authoritative.** Cross-check anything that matters against
>   the game or the [wiki](https://wiki.warframe.com/w/Prime) before spending
>   hours or Void Traces on it. Known disagreements with the wiki are listed in
>   [`TODO.md`](TODO.md) rather than quietly patched over.
>
> Licensing is unaffected: the code is MIT (see [LICENSE](LICENSE)), and the
> game data belongs to Digital Extremes under the terms in
> [`NOTICE.md`](NOTICE.md). **This is an unofficial fan project**, not affiliated
> with or endorsed by Digital Extremes.

Two local tools over one dataset:

- a **collection tracker** for the WARFRAME Primes you own, down to individual parts, and
- a **farm planner** for deciding what to run next.

They share your progress, so ticking off a part in one updates the other.

Everything runs on your own machine. Your collection never leaves it, and there's
no account.

> **One thing can reach the internet: the item artwork.** Whether it does depends
> on how you built the data, and the setup step below gets this right on its own —
> `refresh-data.cmd` / `.sh` pass `--with-images`, which pulls the pictures down
> once, so the app then fetches nothing from anywhere.
>
> Artwork loads from `cdn.warframestat.us` instead when you have no local copy: if
> you ran `python tools/build_data.py` yourself without the flag, if you deleted
> `assets/img/`, or if you are reading the published GitHub Pages copy or the
> single-file build, neither of which can carry local image files. That CDN then
> sees your IP address and which item images your browser asked for. If your
> browser reports *"Cookie has been rejected as third-party"* against files like
> `LavosPrime.png`, that is this — your browser refusing the CDN a cookie, which is
> the outcome you want.
>
> **No collection data, ticks or farm list is ever sent anywhere, in any of those
> cases.** See [Downloading the artwork](#downloading-the-artwork) below.

---

## What you need

- **Python 3.8 or newer** — the standard library only
- **A web browser**
- Windows, macOS or Linux

Nothing else. There are no dependencies to install: no npm packages, no `pip
install`, no build step.

If you are going to *work on* Warframe Prime Hunter rather than just use it, three more tools
are worth having — **Node.js**, **Playwright** and the **GitHub CLI**. All three
are recommended and **none is required**; the suite skips whatever is absent. See
[Recommended tools](#recommended-tools--none-of-them-required).

Every task has a launcher for both platforms — `.cmd` to double-click on Windows,
`.sh` to run on macOS and Linux — and they do exactly the same thing. The Python
underneath is identical on all three; only the launchers and the scheduler differ.

| Task | Windows | macOS / Linux |
|---|---|---|
| Get or update the data | `refresh-data.cmd` | `./refresh-data.sh` |
| Open the site | `serve.cmd` | `./serve.sh` |
| Open it to your network | `serve-lan.cmd` | `./serve-lan.sh` |
| Keep it updated automatically | `tools\schedule.ps1` | `./tools/schedule.sh` |

Check Python is available:

```bash
python --version
```

If that reports 3.8 or higher you are ready. Some systems name it `python3` — use
whichever works, and substitute it throughout.

---

## Getting it

Clone the repository:

```bash
git clone https://github.com/Etheras/Warframe_Prime_Hunter.git
```

Then move into it:

```bash
cd Warframe_Prime_Hunter
```

No release download is published — the repository *is* the app.

> **Cloned it before 2026-08-15, when it was called `VorFrame`?** Your clone still
> works — GitHub redirects the old address indefinitely — but point it at the real
> one so `git remote -v` stops telling you something untrue:
>
> ```bash
> git remote set-url origin https://github.com/Etheras/Warframe_Prime_Hunter.git
> ```
>
> The name of the folder on your disk does not matter; nothing reads it.

---

## Setup

On Windows, **double-click `refresh-data.cmd`**. On macOS or Linux:

```bash
./refresh-data.sh
```

That is the whole setup — nothing is installed. It fetches the current Prime and
relic data straight from Digital Extremes, and pulls the item artwork down so the
site needs no internet connection while you use it. First run takes a couple of
minutes, mostly pictures; later runs are quick, and only fetch what changed.

`refresh-data.cmd` is how you look after the site from then on. Run it whenever you
want fresher data — it updates everything, and cleans up anything it no longer needs.

> The dataset is deliberately **not** committed to the repository, so a fresh clone
> always needs this step first. It also means you start with today's data rather
> than whatever was current when the code was last touched.

### Downloading the artwork

**The setup step above already did this** — `refresh-data` passes `--with-images`,
which is why the first run takes a couple of minutes. This section is for the case
where you called the build script yourself instead, since on its own it leaves the
pictures on the CDN. To pull them down once and never touch the network again:

```bash
python tools/build_data.py --with-images
```

That adds about **8 MB** in `assets/img/` and repoints every card at the local copy —
after it, the site makes no external requests at all.

**You only need that flag once.** From then on the folder's existence is the switch:
every later refresh keeps it current on its own, fetching pictures for new Primes and
deleting ones for items that have left the catalogue. Two extras if you want them:

```bash
python tools/build_data.py --refresh-images
```

re-checks pictures already on disk against the CDN, which takes about an extra minute
and is only worth it if Digital Extremes have repainted an existing item. And
`--no-images` ignores the folder for one run and goes back to the CDN.

The folder is gitignored, for the same reason the dataset is: the artwork belongs to
Digital Extremes and is not ours to redistribute. Delete `assets/img/` to stop using
local copies for good.

---

## Opening the site

On Windows, double-click `serve.cmd`. On macOS or Linux:

```bash
./serve.sh
```

Your browser opens at `http://localhost:8777`. Leave the terminal window open while
you use the site — closing it shuts the server down.

**To open it on your phone**, use `serve-lan.cmd` on Windows or `./serve-lan.sh` on
macOS and Linux. It prints the address to type in.

Your collection is safe from anyone else who opens it: **ticks live in each browser**,
not on the server, so a visitor gets their own empty tracker and cannot see or change
yours. Nothing about your progress is ever sent to the server, and the server accepts
no writes at all — it answers `GET` and nothing else.

What sharing the address *does* expose is read access to the Warframe Prime Hunter folder, `.cache`
included, and directory listings of it. That is all public game data, so the practical
advice is simply: keep private files out of the folder. The local-only server
walks up from port 8777 to find a free one; the network one keeps 8777 fixed, so a
bookmark on your phone survives a restart.

> You *can* open `index.html` directly instead. It is quicker, but some browsers
> refuse to persist storage for pages opened over `file://`, so your ticks may not
> survive a restart. Serving the folder always saves properly.

---

## Using it

Two pages, linked from each other's top bar: the **collection** (`index.html`) and
the **planner** (`plan.html`). Both read the same data and write the same saved
progress — tick a part in one and it is ticked in the other. Which one you open
first depends on the question you have: *what do I still need* or *what do I run
next*.

---

## The collection

### Finding things

- **Search box** at the top — type a Prime, a part, or a relic name. Press `/` to jump to it.
- **Category** in the sidebar — Warframe, Primary, Secondary, Melee, and so on.
- **Availability** in the sidebar — six groups you can switch on and off:

| | Meaning |
|---|---|
| **Farmable now** | Its relics are dropping in missions today |
| **Prime Resurgence (R)** | Buyable from Varzia right now, with Aya |
| **Baro Ki'Teer (B)** | Sold by the Void Trader when he visits |
| **Other sources** | Not from relics at all — a quest, an event, a special vendor. Open one and it tells you exactly where |
| **Vaulted (V)** | Not obtainable except by trading with other players |
| **Founder exclusive** | Excalibur, Lato and Skana Prime. Never coming back — kept at the bottom for that reason |

Want to see only what you can actually get today? Untick **Vaulted** and
**Founder exclusive**.

### Marking what you own

Click the small square in the top-right corner of any card to mark the whole
thing. It turns green.

**Or tick off parts one at a time.** Open any Prime and each part has its own
button on the left. Click it to say you've got that part; the card then shows
your progress (`2/4`). A few parts need two copies — those cycle `0/2 → 1/2 →
2/2` as you click. Tick the last one and the item marks itself collected.

The useful bit: **the farm advice follows what you still need**. With nothing
ticked, Caliban Prime points at Terrorem for 5 of his 7 relics. Tick off the
Blueprint and Chassis and it re-ranks to Zabala, covering the 2 relics that
actually hold the parts you're missing.

The bar at the top right shows your overall progress, and each category heading
shows its own count.

**To hide everything you already own:** untick **Show collected** in the sidebar.
(Unticking **Show not collected** does the opposite — handy for reviewing your
collection.)

The **Mark shown as collected** button applies to everything currently on screen,
so you can filter to a category first and tick it off in one go.

### Finding where to farm something

Click any card. A panel slides in from the right with:

1. **How to get it right now** — farmable, at Varzia, vaulted, or Founder-only.
2. **Best places to farm its relics** — mission nodes ranked by what one round
   there is worth towards a part you still need. That percentage on the
   right is the number to compare; the mission type is in brackets after the node
   name, and hovering "4 of 7 relics" lists which relics you'd be after there.
   Ties break towards lower-level nodes.
3. **Parts and the relics that drop them** — every part, which relics contain it,
   and whether to refine. Each row is shaded by how rare that part is inside that
   relic; hover the rarity for the odds at every refinement and what they cost in
   Void Traces. **Hide collected** and **Hide vaulted** trim the list down.

Vaulted Primes show their relics too, greyed out — useful when you're looking to
trade for a specific one.

### "Vaulting soon"

Some farmable Primes carry an orange **VAULTING SOON** badge. Warframe vaults on a
strict cadence: every Prime Access release vaults the Prime from *seven releases
earlier*, on the same day — that has held for all 41 Warframes vaulted so far. The
badge marks the two oldest still-farmable releases, weapons included, because they
are next in line. If you want them, get them now.

---

## The planner

**Click the crosshair in a card's top-left corner** to say "I'm farming for this".
The **Planner →** button in the collection's top bar counts what you've queued.

The planner answers the other half of the question: given everything you're
chasing, which mission is worth running right now. Your list sits top-left,
showing only the parts still missing — **click a part name
there the moment it drops** and it's banked, the list shrinks, and the plan
re-ranks. Parts needing two copies take two clicks.

**It is two lists, not one**, and each says at the top what it ranks on.
Collecting relics and cracking them are different jobs with different
bottlenecks, and a single number covering both answered neither:

- **Where to go** ranks on **how many relics you want a run hands over**, per
  objective. That is the big number on each row.
- **How to crack them** ranks on **how many openings it takes to finish** a
  relic, per part cleared — so a relic you are blocked on a rare for comes above
  one you are a common away from, which is the right way round when you are
  cracking a stack.

Neither list knows anything about the other's question, which is the point.

Under each node there is also a **percentage**: what one whole run there is worth
towards your list once the relics are opened. It is one line down rather than
gone, because the two genuinely disagree — a node can hand over more relics and be
worth less, when what it hands over is the easy part. The ranking follows the
count; the percentage is there so you can see when it dissents.

Because the percentage scores the whole run, a longer run can beat a faster one on
volume alone — four rounds of a Disruption collect four rewards against a bounty's
one. Hover the rotations on any row for the per-round rate if you want to compare
speed rather than total.

**Rotation counts, and it counts for a lot.** The percentage the game publishes
assumes that rotation has already come up, so it flatters the late ones. Rewards
cycle A → A → B → C, one per round.

How much that matters depends on how far you take a run, so **How far you run** in
the sidebar lets you say. Crucially, a run collects *everything it passes through* —
if you stay to round 4 you have taken the A rewards **and** the B **and** the C, so
all of them count towards that node:

| How far you run | What you collect | Rounds |
|---|---|---|
| **Reset as soon as it drops** | everything up to the last rotation you want something from | 2, 3 or 4, per node |
| **Run straight through** | A×2 + B + C | 4 |
| **AABCAA, then reset** | A×4 + B + C | 6 |
| **Stay for the fissure bonus** | A×3 + B + C, **plus a free relic** | 5 |

The last one is there for something outside the drop tables: staying five
rotations in an endless **Void Fissure** earns you a free Exceptional relic of
that fissure's tier. None of the other settings goes deep enough to collect one.
It is valued as what it is — a *random* relic of the tier, so most of the time
it is worth nothing to your list — and it is added to every endless node equally,
which means it never reorders them against each other. What it changes is whether
staying beats a short mission. Railjack is left out: its fissures are Void
Storms, which have no rotations to stay for.

On **Reset**, if you want a part from rotation A *and* one from rotation C, it costs
the run at 4 rounds — because leaving after round 2 would never get you the C part,
no matter how good the rate looked. Want nothing past A? It costs 2. Hover the
rotations on any row to see what that run collects and what each part of it is
worth — including rotations that pay you nothing.

Missions with no rotation pay once per run and score the same either way, which
means they climb the list on the two "keep playing" settings. The setting is shared
with the collection page, so the two never disagree about where to go.

That refinement advice follows **whatever you're most stuck on**, not whatever is
most likely. If a relic holds a common part you need *and* a rare one, it says
Radiant — because the rare is what's actually holding you up, and pushing it from
2% to 10% matters far more than the common slipping from 25% to 17%. Hover the
percentage to see how many openings it expects.

It also handles Forma: put in how many you have and how many you want, and a
shortfall raises the value of relics you were already going to run. It will never
add a relic just for Forma — you pick that up from the rolls that miss anyway.

**Event nodes are left out by default.** They appear in Digital Extremes' drop
table permanently, but the node only exists on your star chart while that event
is actually running — and the table never says which event it is. There's an
*Include event nodes* checkbox if you know one is live.

### How long a run costs you — *Effort*

A run is not a unit of anything: how far you take an endless mission is your own
choice, and the setting above changes it. So everything is costed **per
objective** instead — a Defense round, a Spy vault, a bounty stage — which takes
2.5 to 6 minutes almost everywhere and is a fact about the mission rather than a
guess about your play. That is the default and it asks you for nothing.

If you would rather rank on real time, open **Effort — optional** in the sidebar
and put minutes against any mission type. One is enough; the whole list re-sorts,
and the big number on each row changes from *per objective* to *per minute* to say
so. Types you leave blank are costed at the average of the ones you filled in and
are drawn in amber on the row, so a borrowed number never looks like one of yours.

Why it is worth filling in: against one player's own timings, ranking per minute
moved Capture and Exterminate nodes up over a hundred places and dropped Spy by a
factor of ten. That is far too big to ignore and far too personal to ship a default
for — a strong player trivialises a Capture while a Spy vault still costs its fixed
hacking time.

### Aya

Some missions drop **Aya**, and one Aya buys one relic *of your choosing* from Varzia
— who stocks whatever Prime Resurgence is currently offering. That makes an Aya drop
worth more than a random relic, because you choose which one you get.

The planner counts it (**Count Aya drops**, on by default), valuing it at the best
relic it could actually buy for your list. Nodes that drop it say `aya` at the end of their
detail line — hover for the rate. Two things worth knowing:

- It **only raises the value of a node you were already going to run.** It will never
  put an Aya-only bounty ahead of somewhere carrying a part you need.
- It is worth **the best relic Varzia is selling this rotation** that is on your list.
  If nothing you still want is in the current rotation, Aya scores nothing — you would
  bank it, but the planner cannot tell you when your Prime will come round.
- If everything you still want is farmable, Aya is worth nothing either: you can
  simply go and get those.
- **If no Resurgence rotation is running at all**, it falls back to the best vaulted
  item on your list. You should never see this: Aya is Resurgence's currency and does
  not drop while no rotation is on, so it is a safety net for a stale dataset rather
  than a situation you will meet in game.

### Ducat values

Each part shows what Baro Ki'Teer pays for a spare — `15d`, `65d` and so on. It is a
fixed game value published per component, not a market price, so it is exact rather
than an estimate. Useful for deciding which duplicates to keep.

It is **information only**. Nothing in the planner reads it: no ranking, no scoring,
no suggestion to sell anything. In particular it has nothing to do with how Aya is
valued — Aya is measured by the relics it buys, never by ducats.

### The rest of the sidebar

Under **Assumptions**, besides *How far you run*:

- **4-man premade** — a full squad cracking the same relic sees four rewards and
  keeps the best, so every chance shown improves. Leave it off for solo or public
  runs. It does one thing beyond the display: it unlocks Disruption's rotation A,
  which is only reachable by a squad deliberately letting conduits fall to a
  schedule.
- **Count Aya drops** — on by default; see *Aya* above.
- **Include event nodes** — off by default; see above.
- **Include Railjack** — off by default. Five live relics drop nowhere else.

And **Effort — optional**, covered above.

The same *How far you run* and *4-man premade* controls appear on the collection
page under **Advanced options**, and they are the same setting — change either and
both pages follow. (One gap: the collection page's copy of *How far you run* has
not been given the *Stay for the fissure bonus* option, so choosing that in the
planner leaves the collection page's box blank. It is written up in
[`TODO.md`](TODO.md).)

### Materials

On the **collection** page, under *Advanced options*: a plain checklist of what
you have versus what you need — Forma, Orokin Cell, and anything else you add.
Normally you can only edit the *have* number, since that is what changes as you
play; press **edit** to rename rows, change targets, or add and remove them.

Mostly it is for your own reference, with one exception: **the Forma row is the
same number the planner's Forma field reads and writes**, so a Forma shortfall
entered in either place raises the value of relics you were already going to run.
Nothing else on the list touches the farm advice.

---

## Backing up your progress

Your ticks are stored in your browser, and both pages read the same store. Click
**Backup** at the top right, then:

- **Download backup** saves everything to a dated `.json` file. Keep it somewhere safe.
- **Restore from file** reads one back.

There is also a text box with the same content, if you would rather copy and paste it
somewhere yourself.

The backup covers everything: whole-item ticks, per-part progress, and your
materials list. Old backups from an earlier version still import — they're treated
as "I own all of these" and expanded into parts.

Worth doing before clearing your browser data.

---

## Keeping it up to date

The data comes from Digital Extremes' official drop tables and item lists, so it
needs a refresh when the game changes — a new Prime, an unvaulting, or a new Prime
Resurgence rotation (those change every 28 days).

### By hand

On Windows, double-click `refresh-data.cmd`. On any platform:

```bash
python tools/build_data.py --if-changed
```

Then reload the page in your browser. `--if-changed` rewrites the data files only
when something actually differs, so it is cheap to run often.

### Automatically — Windows

Right-click `tools\schedule.ps1` → **Run with PowerShell**, or run this in a terminal:

```bash
powershell -ExecutionPolicy Bypass -File tools\schedule.ps1
```

That sets up a Windows scheduled task that checks **every ten minutes**. When
nothing has changed it sends four small requests — each one asking only for what it
does not already have, so the usual answer is "nothing new" and no data at all —
then rebuilds from what is on disk in about a second and a half. A full download
only happens when Digital Extremes actually publish something.

Ten minutes rather than daily because of the **fissures**: the planner marks which
of the places it is sending you is a fissure right now, and only ever marks ones
that have not expired. A fissure runs an hour or two, so those badges are exactly as
fresh as this task — every ten minutes they are as good as live, daily there are
never any.

That is well inside what the source asks for. The fissure list is served with a
two-minute cache lifetime of its own, so this asks five times *less* often than the
API is happy to answer, and asks conditionally on top of that.

While the page is open it re-reads the fissure list on the same ten minutes, from
this site and nowhere else, so a tab you left open in the morning is still right
after lunch without a reload.

Only the scheduling is Windows-specific — the build itself runs anywhere.

Useful variations:

```bash
powershell -ExecutionPolicy Bypass -File tools\schedule.ps1 -Time 08:00
```

```bash
powershell -ExecutionPolicy Bypass -File tools\schedule.ps1 -EveryMinutes 30
```

```bash
powershell -ExecutionPolicy Bypass -File tools\schedule.ps1 -EveryHours 8
```

```bash
powershell -ExecutionPolicy Bypass -File tools\schedule.ps1 -Remove
```

### Automatically — macOS and Linux

Same job, installed into `cron`:

```bash
./tools/schedule.sh
```

It takes the same options — `--every-minutes 30`, `--every 8` (hours), `--at 07:30`,
`--remove`, and `--show` to print the crontab line without installing it.

No account, no API key, and no AI involved — it just reads the official data files
and rebuilds the list.

---

## Taking it with you

### One file you can copy anywhere

> The single file carries **both** the collection and the planner — the tabs switch
> between them in place instead of navigating. It does go back to CDN artwork, since
> local image files cannot travel inside one `.html`.

```bash
python tools/bundle.py
```

Creates `dist/warframe-prime-hunter.html` — the entire site squeezed into a single 1.6 MB file
with the styling, code and data all inside it. Copy it to a USB stick, email it to
yourself, or open it on a machine with no Python at all. Just double-click it.

Only the item pictures still load from the internet; without a connection you get a
placeholder diamond and everything else works normally.

Rebuild it whenever you refresh the data.

### Putting it online

Because it's a plain static site, it can live on **GitHub Pages** for free — which
means you can check your collection from your phone while you're in a mission.
See *Publishing to GitHub* below.

This repository is public and carries the workflow that does it, so it publishes to
<https://etheras.github.io/Warframe_Prime_Hunter/> and rebuilds itself daily. Your
collection does not travel with it: ticks live in whichever browser you are using,
so the phone and the desktop keep separate tallies unless you move a **Backup**
between them.

> **The Pages source has to be *GitHub Actions*, not *Deploy from a branch*.** This
> is the one setting that looks optional and is not. The dataset is deliberately
> never committed (see below), so a branch build serves the repo exactly as it
> stands — `index.html` loads, `data/prime-data.js` 404s, and every visitor gets
> *"No data yet. Double-click refresh-data.cmd"*, which is useless advice to give
> someone reading your site on their phone. Only the workflow has a dataset to
> publish, because it builds one. Set it under **Settings → Pages → Source**.

---

## Publishing to GitHub

**You do not need the GitHub CLI.** Plain `git` does all of it, and Git for Windows
already includes the credential manager that handles the login.

### What actually gets uploaded

Only **40 source files, about 760 KB** — over half of that is the four documents.
Specifically:

- ✅ The code — `index.html`, `plan.html`, `assets/`, `tools/`, the helper scripts and the docs
- ❌ **Not** Digital Extremes' game data (`data/prime-data.js` / `.json`)
- ❌ **Not** the download cache (`.cache/`) or the single-file build (`dist/`)
- ❌ **Not** your editor or tool settings (`.claude/`, `.vscode/`)
- ❌ **Not** your collection — that lives only in your browser

DE's data is re-downloaded on demand instead of being redistributed. Anyone who
clones the repo runs the refresh step and gets the current data straight from the
source, which is fresher than anything that could have been committed.

### Steps

**1. Tell git who you are** (once per machine). Use your GitHub *noreply* address so
a public repo doesn't publish your real email:

```bash
git config --global user.name "Your Name"
```

```bash
git config --global user.email "YOURUSERNAME@users.noreply.github.com"
```

**2. Make the first commit** — everything is already staged:

```bash
git commit -m "Warframe Prime Hunter: Prime collection and relic farming tracker"
```

**3. Create an empty repo on the website:** <https://github.com/new>

Name it whatever you like — `warframe-prime-hunter`, say. Pick a form with no
spaces in it: GitHub substitutes them, and the name you get is then not quite the
name you typed. **Don't** tick "Add a README", ".gitignore" or a licence — the repo
must start empty or the first push will be rejected.

**4. Connect and push** (replace `YOURUSERNAME`):

```bash
git remote add origin https://github.com/YOURUSERNAME/warframe-prime-hunter.git
```

```bash
git push -u origin main
```

A browser window opens for you to sign in to GitHub. That's the credential manager —
it stores the login so you're never asked again.

**5. Turn on the website** (optional)

In the repo: **Settings → Pages → Source: GitHub Actions**.

Then **Actions → Build and publish site → Run workflow**. A couple of minutes later
your site is live at `https://YOURUSERNAME.github.io/REPO-NAME/`, with the standalone
single-file version at `/warframe-prime-hunter-standalone.html`.

Pages needs a **public** repo on the free plan.

**6. It keeps itself current**

`.github/workflows/publish.yml` rebuilds the data from DE every day at 18:40 UTC and
republishes the site — so it stays up to date whether or not your PC is switched on,
and the data still never enters the repository.

**And it refreshes the fissures every ten minutes.** That used to be the one thing
the published copy could not do: fissures turn over every hour or two, so a site
rebuilt once a day always found them expired and marked nothing. A second, much
lighter run now takes the slow-moving data straight from the build cache and fetches
only the fissure list, so the published planner marks tonight's fissures the same
way a local copy does. Your own scheduled task is now a preference rather than a
necessity.

Worth knowing: GitHub's schedules are best-effort. Runs are queued and can be
delayed or skipped when the service is busy, so ten minutes is what it aims for
rather than a promise.

> The workflow has **read-only** access to your code and uses no secrets or API
> keys — every source it touches is public.

---

## If something goes wrong

**The page is blank or says data is missing**
Run `refresh-data.cmd`, or `python tools/build_data.py`.

**"python is not recognised"**
Python isn't on your PATH. Reinstall it from [python.org](https://www.python.org/downloads/)
and tick *Add Python to PATH* during setup.

**The refresh fails (no internet, or a site is down)**
Your existing data is untouched. Try again later, or rebuild from the local cache:

```bash
python tools/build_data.py --offline
```

**"Port 8777 is already in use"**
The site is already running in another window — check your open windows before
starting a second one.

**My ticks disappeared**
Most likely the browser cleared its storage, or you opened `index.html` directly
instead of serving the folder. Restore from a **Backup** copy if you have one.

---

## Licence and attribution

Warframe Prime Hunter's own code — the build pipeline, the site, the docs — is **[MIT
licensed](LICENSE)**. Do what you like with it.

The game data is a different matter. WARFRAME, its item names, artwork and
trademarks belong to **Digital Extremes Ltd.**, and are used here under their
[Content Policy](https://www.warframe.com/en/contentpolicy) for non-commercial
fan works. That policy sets three practical limits:

- **Non-commercial only** — don't sell it, don't put ads on it
- **No Warframe or Digital Extremes logos** without their written consent
- Be clear it's **unofficial**

Warframe Prime Hunter satisfies all three, and the site footer says so on every page.

Data sources and their licences (catalogue from the WARFRAME Wiki under CC BY-SA,
item and worldstate data from WFCD under MIT and Apache-2.0) are listed in
[NOTICE.md](NOTICE.md). The dataset itself is never committed — it's downloaded
fresh on every build, so nothing is redistributed from here.

> Warframe Prime Hunter is an unofficial fan project. It is not affiliated with, endorsed,
> sponsored, or approved by Digital Extremes Ltd.

---

## Running the tests

If you change anything under `tools/` or `assets/`:

```bash
python tests/test_build.py
```

No network needed, about a second. That one command runs everything, including
the browser tests. Add `--online` to also clone the repo into a temporary folder
and build it from scratch — the path a new user takes.

**Node.js is recommended, not required.** The tests that cover the JavaScript —
the rotation model, the bounty clock, the saved-progress keys — run under Node's
own test runner. Without Node they are skipped and the rest still runs, which is
why nothing here asks you to install it just to *use* Warframe Prime Hunter:

```
browser
  skip browser tests (no Node found — the site does not need it)
```

If you have it, they simply appear in the same output as everything else. The
tests use only Node's standard library, so there is nothing to `npm install` for
these, and **the site itself never needs Node at all.**

See [Recommended tools](#recommended-tools--none-of-them-required) below for how
to install it.

### Testing the pages themselves — optional

The tests above cover the model, not the pages. Driving the real pages needs a
real browser, which is a large download, so it is opt-in:

```bash
npm install
npx playwright install chromium
```

That adds nineteen tests that open the collection and the planner in Chromium and
check what a person would: the grid renders without console errors, ticking a
part survives a reload, tooltips appear, the backup dialog carries your
collection, filters and materials stick, the two pages agree about the farm
list, a bounty row names its rotation, a node says when it is a fissure and
stops saying so once it closes, and the layout does not scroll sideways on a
phone.

Without Playwright you get one line and everything else runs as normal:

```
  skip page tests (Playwright is not installed (npm install))
```

`package.json` exists only for this. **Nothing the site ships depends on it**,
and `node_modules/` is not tracked.

### Sketching a change before building it

`temp_mockup.html` at the repo root is a scratchpad for trying a layout against
your real data — it loads the same dataset and stylesheet the app does. Open it
at `/temp_mockup.html` while `serve.cmd` is running.

It is **gitignored and served only to this machine**: `serve.py` refuses it to
any other address, so sharing the LAN server never shares a half-finished idea.
Delete it whenever; nothing depends on it.

---

## Recommended tools — none of them required

Warframe Prime Hunter needs **Python and a browser**, and nothing else. Everything below is
for working *on* it rather than using it: each one adds a layer of checking or
control, each is skipped cleanly when absent, and none of them is ever needed to
run the site or refresh the data.

| Tool | What it adds | Without it |
|---|---|---|
| **Node.js** | The tests covering the JavaScript — rotation model, bounty clock, storage keys, backup validation | Those tests skip; the Python suite still runs |
| **Playwright** | Nineteen tests that drive the real pages in Chromium | Those skip too, with a reason |
| **GitHub CLI** (`gh`) | Watching CI, reading failures, and managing the repo from the terminal | Use the Actions tab in a browser instead |

### Installing them

**Windows**

```bash
winget install OpenJS.NodeJS.LTS
winget install GitHub.cli
```

**macOS**

```bash
brew install node gh
```

**Linux (Debian/Ubuntu)**

```bash
sudo apt install nodejs npm
sudo apt install gh
```

Then, from the repo root, for the page tests only:

```bash
npm install
npx playwright install chromium
```

> **A terminal that was already open when you installed something will not have
> it on `PATH`.** Open a new one. This costs more time than it should — it looks
> exactly like a failed install.

### Using the GitHub CLI

One-time sign-in. `gh` acts as you, so it needs this even for a public repo —
reading your own workflow runs is not an anonymous operation:

```bash
gh auth login
```

Then, the three worth knowing. Did the last push pass?

```bash
gh run list --limit 5
```

Why did it fail — printing only the failing steps, rather than the whole log:

```bash
gh run view --log-failed
```

Watch the run triggered by a push as it happens:

```bash
gh run watch
```

**This is a control tool, not a test tool.** The suite tells you whether the code
is right; `gh` tells you whether the *published* build agrees, on a clean Linux
machine with no cache and none of your local state. Those are different
questions, and this project has already been bitten by the difference: the tests
passed locally while CI was red for two commits, because a source that is
optional in spirit was fatal in code and only a cold runner ever hit it.

To reproduce what CI does, without pushing:

```bash
python tests/test_build.py --online
```

### Blocking shell writes to source files — optional, and only if you use Claude Code

`tools/guard_shell_writes.py` refuses any shell command that would write
`assets/*.js`, `assets/*.css`, `tools/*.py`, `tests/*` or an `.html` file — a
heredoc, a `>` redirect, `sed -i`, `Set-Content`, `python -c`. Reads, greps,
builds and redirects to `/tmp` are untouched.

It exists because a shell mangles escapes on the way in, three times here: `\b`
became a literal backspace byte and shipped a regex that matched nothing, `\n`
became a real newline mid-string, and a stray multibyte character rode in from a
paste. All three pass `node --check`, look right in a diff, and show up only as
behaviour that quietly does not happen. Editors do not have this failure mode.

The suite already catches the damage — that runs for everyone, with nothing to
set up. This is the other half, and it only helps if an assistant is writing
files here. `.claude/` is gitignored, so wire it per machine in
`.claude/settings.local.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|PowerShell",
        "hooks": [
          {
            "type": "command",
            "command": "python \"${CLAUDE_PROJECT_DIR:-.}/tools/guard_shell_writes.py\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

Check it before trusting it — this must print a refusal rather than creating the
file:

```bash
echo '{"tool_input":{"command":"echo x >> assets/app.js"}}' | python tools/guard_shell_writes.py
```

---

## Want more detail?

- **[PROJECT.md](PROJECT.md)** — how it's built: where each piece of data comes
  from, how the three sources disagree, the scoring model, and the quirks worth
  knowing about.
- **[TODO.md](TODO.md)** — everything still outstanding, and the list of
  things that should be corrected on the wiki rather than patched here.
- **[STYLE.md](STYLE.md)** — the visual rules, so new pages look like the
  existing ones without anyone having to compare them by eye.
Working on it yourself? **PROJECT.md §2** sets out the ground rules: keep the
docs current, never put a language model in the data pipeline, fix the wiki
rather than patching around it, and ask before pushing.
