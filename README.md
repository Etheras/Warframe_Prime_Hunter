# VorFrame

A local website for tracking which WARFRAME **Primes** you own, and finding out
**where to farm the relics** for the ones you don't.

Everything runs on your own machine. Nothing is uploaded, and there's no account.

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

### Finding things

- **Search box** at the top — type a Prime, a part, or a relic name. Press `/` to jump to it.
- **Category** in the sidebar — Warframe, Primary, Secondary, Melee, and so on.
- **Availability** in the sidebar — five groups you can switch on and off:

| | Meaning |
|---|---|
| **Farmable now** | Its relics are dropping in missions today |
| **Prime Resurgence (R)** | Buyable from Varzia right now, with Aya |
| **Vaulted (V)** | Not obtainable except by trading with other players |
| **Baro Ki'Teer (B)** | Sold by the Void Trader |
| **Founder / special** | Excalibur, Lato and Skana Prime, plus a few odd ones |

Want to see only what you can actually get today? Untick **Vaulted** and
**Founder / special**.

### Marking what you own

Click the small square in the top-right corner of any card. It turns green.

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
2. **Best places to farm its relics** — mission nodes ranked by *how many* of that
   Prime's relics drop there. The number on the right is the important bit: "5 of 7
   relics" means one trip to that node can drop five of the seven relics you need.
3. **Parts and the relics that drop them** — every part, which relics contain it,
   the odds at each refinement level (Intact → Radiant), and the top few places each
   relic drops.

Vaulted Primes show their relics too, greyed out — useful when you're looking to
trade for a specific one.

### Backing up your collection

Your ticks are stored in your browser. Click **Backup** at the top right to copy
them out as text, or paste a saved copy back in and press **Import**.

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

Only **14 source files, about 120 KB**. Specifically:

- ✅ The code — `index.html`, `assets/`, `tools/`, the `.cmd` scripts, the two docs
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

[PROJECT.md](PROJECT.md) covers how it's built — where each piece of data comes
from, how the files fit together, and the quirks worth knowing about.
