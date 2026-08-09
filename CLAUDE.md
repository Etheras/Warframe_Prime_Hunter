# Working on VorFrame

Read **[PROJECT.md](PROJECT.md)** before changing anything — it explains the data
sources, how they disagree, and why the code compensates the way it does. Most
surprises in this repo are documented there already.

---

## Standing rules

### 1. Keep the documentation current, always

`README.md`, `PROJECT.md` and `TODO.md` are part of the deliverable, not an
afterthought. **Every change updates them in the same commit.** This is an
explicit, repeated request from the project owner.

| File | Audience | Update it when |
|---|---|---|
| `README.md` | the user, day to day | anything visible changes — a control, a label, a workflow |
| `PROJECT.md` | whoever maintains this next | architecture, data sources, models, or a hard-won gotcha |
| `TODO.md` | both | you notice something worth doing, finish something, or make a decision worth recording |

If you find a stale line while working, fix it — do not leave it for later.

### 2. Nothing in the data pipeline may need an LLM

Every source is JSON or a regularly structured HTML table, parsed
deterministically, so a scheduled task keeps the site current unattended. Do not
introduce a step that needs a model, an API key, or a human reading prose. Prose
sources (news posts, update notes) were considered and deliberately rejected —
see PROJECT.md §3.

### 3. Fix the wiki, not the app

Where our data knowingly disagrees with `wiki.warframe.com`, it is recorded in
TODO.md under *"Should be fixed on the wiki, not here"*, along with whatever
local override compensates. Add to that list rather than quietly patching data.
Categories stay on the wiki deliberately; availability facts come from DE.

### 4. Commit freely, ask before pushing

`git commit` as part of normal work, with a message that explains *why*. **Always
ask before `git push`** — every time, not once. A commit is local and reversible;
a push is outward-facing.

### 5. No Node, no build step

The machine has Python 3.14, git and a browser. No npm, no bundler, no
framework. The site is plain HTML/CSS/JS with the data baked into a `.js` file so
it runs from `file://`. Keep it that way.

---

## Layout in one paragraph

`tools/build_data.py` fetches and joins everything into `data/vorframe-data.js`
(gitignored — DE's data is never redistributed). `index.html` + `assets/app.js`
is the collection view; `plan.html` + `assets/plan.js` is the farm planner. They
share `localStorage` keys, so a part ticked on one page shows on the other.
`tools/official.py` holds the parsers for DE's drop table and public export.

## Verifying a change

There is no test suite yet (it is in TODO). Verify in the browser and say what
you actually checked:

```bash
python tools/build_data.py --offline   # rebuild from cache, fast
python tools/serve.py                  # then look at it
```

Reset state between checks with `localStorage.clear()`, and leave it clean when
you finish — the owner's real collection lives in those keys.
