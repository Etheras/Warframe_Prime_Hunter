# VorFrame

Two local tools over one dataset:

- a **collection tracker** for the WARFRAME Primes you own, down to individual parts, and
- a **farm planner** for deciding what to run next.

They share your progress, so ticking off a part in one updates the other.

Everything runs on your own machine. Your collection never leaves it, and there's
no account.

> **One exception, so you know about it:** the item artwork is loaded from
> `cdn.warframestat.us` as you browse, rather than being stored locally. That CDN
> therefore sees your IP address and which item images your browser asked for. No
> collection data, ticks or farm list is ever sent anywhere. If your browser
> reports *"Cookie has been rejected as third-party"* against files like
> `LavosPrime.png`, that is this — and it is your browser refusing the CDN a
> cookie, which is the outcome you want.

---

## What you need

- **Windows** (you're on Windows 11)
- **Python 3.8 or newer** — already installed, version 3.14
- A web browser

That's it. There is nothing to download or install — no Node, no npm, no libraries.

To double-check Python is available, open a terminal and run:

```bash
python --version
```

If that prints a version number, you're ready.

---

## Setup

Fetch the game data once, by double-clicking:

```
refresh-data.cmd
```

It takes about a minute and downloads the current Prime and relic data straight
from Digital Extremes. That's the whole setup — nothing gets installed.

> The data isn't stored in this repository, so a fresh copy always needs this step
> first. It also means you always start with today's data rather than whatever was
> current when the code was last touched.

---

## Opening the site

Double-click:

```
serve.cmd
```

Your browser opens at `http://localhost:8777`. Leave that little black window open
while you use the site — closing it shuts the site down.

> You *can* also just double-click `index.html`. It's quicker, but some browsers
> refuse to save data for files opened that way, so your ticks might not survive a
> restart. `serve.cmd` always saves properly.

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

It ranks every node by what **one round** there is worth towards *anything* still
on your list, then tells you what refinement to take each relic to.

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

### Advanced options

At the bottom of the sidebar:

- **4-squad, same relic** — a full squad cracking the same relic sees four
  rewards and keeps the best, so the odds shown become much better. Leave it off
  for solo runs. It only changes the numbers displayed, nothing else.
- **Materials** — a plain checklist of what you have versus what you need
  (Forma, Orokin Cell, and anything else you add). Purely for your own reference;
  it doesn't feed the farm advice. Normally you can only edit the *have* number,
  since that's what changes as you play — press **edit** to rename rows, change
  targets, or add and remove them.

---

## Backing up your progress

Your ticks are stored in your browser, and both pages read the same store. Click **Backup** at the top right to copy
them out as text, or paste a saved copy back in and press **Import**.

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

Double-click:

```
refresh-data.cmd
```

Then reload the page in your browser.

### Automatically

Right-click `tools\schedule.ps1` → **Run with PowerShell**, or run this in a terminal:

```bash
powershell -ExecutionPolicy Bypass -File tools\schedule.ps1
```

That sets up a Windows scheduled task that checks once a day at 18:30. On days when
nothing has changed it finishes in about a second without touching anything.

Useful variations:

```bash
powershell -ExecutionPolicy Bypass -File tools\schedule.ps1 -Time 08:00
```

```bash
powershell -ExecutionPolicy Bypass -File tools\schedule.ps1 -Remove
```

No account, no API key, and no AI involved — it just reads the official data files
and rebuilds the list.

---

## Taking it with you

### One file you can copy anywhere

```bash
python tools/bundle.py
```

Creates `dist/vorframe.html` — the entire site squeezed into a single 1.6 MB file
with the styling, code and data all inside it. Copy it to a USB stick, email it to
yourself, or open it on a machine with no Python at all. Just double-click it.

Only the item pictures still load from the internet; without a connection you get a
placeholder diamond and everything else works normally.

Rebuild it whenever you refresh the data.

### Putting it online

Because it's a plain static site, it can live on **GitHub Pages** for free — which
means you can check your collection from your phone while you're in a mission.
See *Publishing to GitHub* below.

---

## Publishing to GitHub

**You do not need the GitHub CLI.** Plain `git` does all of it, and Git for Windows
already includes the credential manager that handles the login.

### What actually gets uploaded

Only **21 source files, about 259 KB**. Specifically:

- ✅ The code — `index.html`, `plan.html`, `assets/`, `tools/`, the `.cmd` scripts and the docs
- ❌ **Not** Digital Extremes' game data (`data/vorframe-data.js` / `.json`)
- ❌ **Not** the download cache (`.cache/`) or the single-file build (`dist/`)
- ❌ **Not** your editor or tool settings (`.claude/`, `.vscode/`)
- ❌ **Not** your collection — that lives only in your browser

DE's data is re-downloaded on demand instead of being redistributed. Anyone who
clones the repo runs `refresh-data.cmd` and gets the current data straight from the
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
git commit -m "VorFrame: Prime collection and relic farming tracker"
```

**3. Create an empty repo on the website:** <https://github.com/new>

Name it `VorFrame`. **Don't** tick "Add a README", ".gitignore" or a licence — the
repo must start empty or the first push will be rejected.

**4. Connect and push** (replace `YOURUSERNAME`):

```bash
git remote add origin https://github.com/YOURUSERNAME/VorFrame.git
```

```bash
git push -u origin main
```

A browser window opens for you to sign in to GitHub. That's the credential manager —
it stores the login so you're never asked again.

**5. Turn on the website** (optional)

In the repo: **Settings → Pages → Source: GitHub Actions**.

Then **Actions → Build and publish site → Run workflow**. A couple of minutes later
your site is live at `https://YOURUSERNAME.github.io/VorFrame/`, with the standalone
single-file version at `/vorframe-standalone.html`.

Pages needs a **public** repo on the free plan.

**6. It keeps itself current**

`.github/workflows/publish.yml` rebuilds the data from DE every day at 18:40 UTC and
republishes the site — so it stays up to date whether or not your PC is switched on,
and the data still never enters the repository. Once that's running you don't need
the Windows scheduled task any more.

> The workflow has **read-only** access to your code and uses no secrets or API
> keys — every source it touches is public.

---

## If something goes wrong

**The page is blank or says data is missing**
Run `refresh-data.cmd`.

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
instead of using `serve.cmd`. Restore from a **Backup** copy if you have one.

---

## Licence and attribution

VorFrame's own code — the build pipeline, the site, the docs — is **[MIT
licensed](LICENSE)**. Do what you like with it.

The game data is a different matter. WARFRAME, its item names, artwork and
trademarks belong to **Digital Extremes Ltd.**, and are used here under their
[Content Policy](https://www.warframe.com/en/contentpolicy) for non-commercial
fan works. That policy sets three practical limits:

- **Non-commercial only** — don't sell it, don't put ads on it
- **No Warframe or Digital Extremes logos** without their written consent
- Be clear it's **unofficial**

VorFrame satisfies all three, and the site footer says so on every page.

Data sources and their licences (catalogue from the WARFRAME Wiki under CC BY-SA,
item and worldstate data from WFCD under MIT and Apache-2.0) are listed in
[NOTICE.md](NOTICE.md). The dataset itself is never committed — it's downloaded
fresh on every build, so nothing is redistributed from here.

> VorFrame is an unofficial fan project. It is not affiliated with, endorsed,
> sponsored, or approved by Digital Extremes Ltd.

---

## Want more detail?

- **[PROJECT.md](PROJECT.md)** — how it's built: where each piece of data comes
  from, how the three sources disagree, the scoring model, and the quirks worth
  knowing about.
- **[TODO.md](TODO.md)** — known gaps, decisions already made, and the list of
  things that should be corrected on the wiki rather than patched here.
- **[STYLE.md](STYLE.md)** — the visual rules, so new pages look like the
  existing ones without anyone having to compare them by eye.
Working on it yourself? **PROJECT.md §2** sets out the ground rules: keep the
docs current, never put a language model in the data pipeline, fix the wiki
rather than patching around it, and ask before pushing.
