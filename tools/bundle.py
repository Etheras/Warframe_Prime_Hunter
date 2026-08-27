#!/usr/bin/env python3
"""
Fold the whole site into one self-contained .html file.

The result has the stylesheet, both scripts and the dataset inlined, so it is a
single file you can copy to a USB stick, email to yourself, or drop on any
machine with a browser. No Python, no server, no internet needed to open it.

    python tools/bundle.py            -> dist/warframe-prime-hunter.html

It carries **both** views. They are two views of one dataset, so shipping only
the collection made the standalone build a lesser thing than the served site.
Both bodies go into one document and the existing tabs switch between them in
JavaScript rather than navigating.

Merging two whole pages is not free, and this file used to claim it was: the
line here said the two pages "share exactly one element id -- the tab itself".
They share eleven. The backup dialog and the site footer are the same chrome on
both, so `cut_shared` lifts them out of the bodies and emits one of each below
the views; the rest of what was duplicated was duplicated *wiring* rather than
markup, and shared.js is now idempotent about it. Both scripts still run over
the whole document before either view is shown, which is what makes one dialog
enough for two views -- but nothing about that was ever true by luck, and the
measurements that showed it were not are in `PROJECT.md`.

Only the item artwork still comes from the network; without it the cards fall
back to a placeholder glyph and everything else keeps working. If the dataset
was built with --with-images the artwork points at local files, which cannot
travel inside a single .html, so those paths are rewritten back to the CDN here.
"""

from __future__ import annotations

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "dist")
OUT_FILE = os.path.join(OUT_DIR, "warframe-prime-hunter.html")

CLOSE_SCRIPT = "</" + "script>"
ESCAPED_CLOSE = "<" + chr(92) + "/" + "script>"

# What actually ends a script block, which is not the string above.
#
# HTML matches the close tag ASCII-case-insensitively and terminates on
# `</script` followed by whitespace, `/` or `>`. The guard below used to be a
# literal `str.replace` of the exact lowercase `</script>`, so `</ScRiPt>` and
# `</script ` walked straight out of the block. Item names reach the inlined
# dataset from wiki.warframe.com with only whitespace normalising, and the
# standalone is copied to _site/ beside the tracker - same origin, same
# localStorage - so that was a public wiki edit away from running.
#
# `<!--` is deliberately not touched. It opens the escaped text state and is a
# real hazard in a serialiser, but `guard` runs over whole JavaScript files,
# where `<!--` is a legal line comment and a backslash is a syntax error. The
# sequence cannot occur in the JSON blob (json.dumps escapes nothing there, but
# `<` only appears inside strings, where the substitution below is safe).
CLOSE_SCRIPT_RE = re.compile(r"</(script)(?=[\s/>])", re.IGNORECASE)


CSP_META_RE = re.compile(
    r'<meta http-equiv="Content-Security-Policy" content="([^"]*)"\s*/?>',
    re.IGNORECASE)


def standalone_csp(policy: str) -> str:
    """
    The pages' policy, adjusted for a file that is nothing but inline blocks.

    Character for character the transform serve.py's build_local_csp applies to
    temp_mockup.html, and for the same reason: every script and the stylesheet
    are inlined here, so 'self' alone would block the entire document. 'self'
    is kept beside it because the standalone is also published to _site/ and is
    served from the Pages origin, where it means something.

    Not idempotent - `script-src 'self'` is a prefix of its own output, so
    applying this twice yields two 'unsafe-inline' tokens. bundle.py runs it
    once against a freshly read index.html. serve.py's build_local_csp has the
    same property today.
    """
    return (policy
            .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
            .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'"))


def guard_text(text: str) -> str:
    """
    Inlined text with anything that would end the script block neutralised.

    Module level rather than a closure inside `build`, so the suite can ask it
    directly what it does to `</ScRiPt>` instead of building the whole bundle
    and grepping the result. Case is preserved: JS source carrying the sequence
    inside a string keeps its own spelling.
    """
    return CLOSE_SCRIPT_RE.sub(lambda m: ESCAPED_CLOSE[:3] + m.group(1), text)


def read(*parts: str) -> str:
    path = os.path.join(ROOT, *parts)
    if not os.path.exists(path):
        raise SystemExit(f"missing {path} — run tools/build_data.py first")
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def body_after_header(doc: str) -> str:
    """Everything between </header> and the first <script>."""
    start = doc.index("</header>") + len("</header>")
    return doc[start:doc.index("<script", start)]


# Chrome that is the same thing on both pages, so the merged document must hold
# exactly one of it. Both are matched by their id rather than by their tag alone,
# since either page could grow a second <footer> or <dialog> that is genuinely
# its own.
SHARED_CHROME = (
    ("siteFoot", re.compile(r'[ \t]*<footer[^>]*id="siteFoot"[^>]*>.*?</footer>\s*', re.S)),
    ("dataDlg", re.compile(r'[ \t]*<dialog[^>]*id="dataDlg"[^>]*>.*?</dialog>\s*', re.S)),
)


def cut_shared(body: str, page: str) -> tuple[str, dict[str, str]]:
    """Lift the shared chrome out of one page body, and say so if it is not there.

    Silence here is the expensive kind. Leaving both copies in is not a crash and
    not visible on the first tab you look at: it duplicates nine element ids, and
    `getElementById` then hands every caller the collection's copy, so the
    planner tab carried an empty footer -- the one element that holds the licence
    and the Content Policy attribution -- and nobody saw it for as long as the
    single file has existed.
    """
    taken: dict[str, str] = {}
    for name, pattern in SHARED_CHROME:
        found = pattern.findall(body)
        if len(found) != 1:
            raise SystemExit(
                f"bundle: {page} has {len(found)} elements with id={name!r}, "
                "expected exactly one. The single file merges both pages, so "
                "shared chrome is taken once and emitted once; if this markup "
                "moved or gained a copy, move this with it.")
        taken[name] = found[0].strip()
        body = pattern.sub("", body, count=1)
    return body, taken


def main() -> int:
    html = read("index.html")
    plan = read("plan.html")
    css = read("assets", "styles.css")
    # shared.js and rotation.js first: both pages read them at load
    shared_js = read("assets", "shared.js")
    rotation_js = read("assets", "rotation.js")
    model_js = read("assets", "model.js")
    app_js = read("assets", "app.js")
    plan_js = read("assets", "plan.js")
    data = read("data", "prime-data.js")

    guard = guard_text

    # --with-images repoints items at assets/img/*, which does not survive being
    # copied around as a lone file. Put them back on the CDN for the bundle only.
    localised = data.count('"assets/img/')
    if localised:
        data = data.replace('"assets/img/', '"https://cdn.warframestat.us/img/')

    # The planner's search box lives inside its own header, and we keep only the
    # collection's header. Carry it into the planner view so adding a Prime works.
    m = re.search(r'<div class="search-wrap">.*?</div>\s*</div>', plan, re.S)
    plan_search = m.group(0) if m else ""

    shell = html[:html.index("</header>") + len("</header>")]
    # Matched by pattern rather than exact text: the tag is written self-closing
    # so the page stays well-formed as XML, and a plain `>` form should keep
    # working too. An exact-string match silently did nothing when the markup
    # gained its slash, leaving the bundle pointing at a stylesheet it did not
    # contain.
    shell = re.sub(r'<link rel="stylesheet" href="assets/styles\.css"\s*/?>',
                   lambda _: "<style>" + os.linesep + css + os.linesep + "</style>",
                   shell, count=1)

    # The same rewrite for the policy, and it fails loudly rather than quietly.
    # A stylesheet that goes missing is visible on the first glance at the page;
    # a CSP that goes missing looks exactly like a CSP that is working, which is
    # the more expensive of the two failures. The comment above records that the
    # link rewrite did silently nothing once - this one is not allowed to.
    shell, replaced = CSP_META_RE.subn(
        lambda m: '<meta http-equiv="Content-Security-Policy" content="'
                  + standalone_csp(m.group(1)) + '" />',
        shell, count=1)
    if replaced != 1:
        raise SystemExit(
            "bundle: index.html has no Content-Security-Policy meta tag to "
            "rewrite, so the standalone would ship with no policy at all. "
            "If the tag moved, move this rewrite with it.")
    # the tabs toggle sections instead of navigating to files that are not here
    shell = shell.replace('href="index.html"', 'href="#collection" data-view="collection"')
    shell = shell.replace('href="plan.html"', 'href="#planner" data-view="planner"')

    switcher = """
<script>
/* One file, two views. The served site uses two pages and real links; here the
   same tabs toggle sections. Both scripts have already run against the whole
   document by this point, so nothing needs re-initialising on a switch. */
(function () {
  var views = {
    collection: document.getElementById("view-collection"),
    planner: document.getElementById("view-planner")
  };
  /* The collection's search sits in the shared header; the planner's came
     across with its own view. Only one of them applies at a time. */
  var headerSearch = document.querySelector("header.topbar .search-wrap");
  function show(name) {
    Object.keys(views).forEach(function (k) {
      if (views[k]) { views[k].hidden = (k !== name); }
    });
    if (headerSearch) { headerSearch.hidden = (name !== "collection"); }
    Array.prototype.forEach.call(document.querySelectorAll(".viewtab"), function (t) {
      var mine = t.getAttribute("data-view") === name;
      t.classList.toggle("on", mine);
      if (mine) { t.setAttribute("aria-current", "page"); }
      else { t.removeAttribute("aria-current"); }
    });
    try { history.replaceState(null, "", "#" + name); } catch (e) { /* file:// */ }
  }
  Array.prototype.forEach.call(document.querySelectorAll(".viewtab[data-view]"), function (t) {
    t.addEventListener("click", function (e) {
      e.preventDefault();
      show(t.getAttribute("data-view"));
    });
  });
  show(location.hash === "#planner" ? "planner" : "collection");
})();
</script>
"""

    # The shared chrome comes out of both bodies and goes back once, below both
    # views rather than inside either. The footer is identical in the two pages
    # and empty in both -- shared.js writes it -- so the collection's is kept for
    # no reason beyond it being first. The backup dialog is taken from the
    # planner, because only its wording is true of the merged app: the
    # collection's says "Backup / restore collection", and the file this button
    # writes carries the farm list and the planner's options as well. The
    # handlers on it are the collection's, since app.js runs first and claims the
    # dialog -- which is consistent, not a mismatch: `backupPayload` has always
    # written every slice whichever page asked for it.
    collection_body, collection_chrome = cut_shared(body_after_header(html), "index.html")
    planner_body, planner_chrome = cut_shared(body_after_header(plan), "plan.html")
    footer = collection_chrome["siteFoot"]
    dialog = planner_chrome["dataDlg"]

    parts = [
        shell,
        '<div id="view-collection">',
        collection_body,
        "</div>",
        '<div id="view-planner" hidden>',
        plan_search,
        planner_body,
        "</div>",
        footer,
        dialog,
        "<script>", guard(data), CLOSE_SCRIPT,
        "<script>", guard(shared_js), CLOSE_SCRIPT,
        "<script>", guard(rotation_js), CLOSE_SCRIPT,
        "<script>", guard(model_js), CLOSE_SCRIPT,
        "<script>", guard(app_js), CLOSE_SCRIPT,
        "<script>", guard(plan_js), CLOSE_SCRIPT,
        switcher,
        "</body>",
        "</html>",
    ]
    out = os.linesep.join(parts)

    # Nothing external should be left behind. Template placeholders like
    # src="${esc(it.image)}" live inside the inlined script, not the markup.
    leftovers = {
        m for m in re.findall(r'(?:src|href)="(?!data:|https?:|#)([^"]+)"', out)
        if "${" not in m
    }
    if leftovers:
        print("  ! still referencing local files:", ", ".join(sorted(leftovers)))
    if localised:
        print(f"  artwork: {localised} local paths rewritten back to the CDN")
    print("  both views inlined: collection + planner")

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as fh:
        fh.write(out)

    size = os.path.getsize(OUT_FILE) / 1024 / 1024
    print(f"wrote {os.path.relpath(OUT_FILE, ROOT)} ({size:.2f} MB) — open it anywhere")
    return 0


if __name__ == "__main__":
    sys.exit(main())
