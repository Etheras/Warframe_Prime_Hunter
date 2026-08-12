#!/usr/bin/env python3
"""
Fold the whole site into one self-contained .html file.

The result has the stylesheet, both scripts and the dataset inlined, so it is a
single file you can copy to a USB stick, email to yourself, or drop on any
machine with a browser. No Python, no server, no internet needed to open it.

    python tools/bundle.py            -> dist/vorframe.html

It carries **both** views. They are two views of one dataset, so shipping only
the collection made the standalone build a lesser thing than the served site.
Both bodies go into one document and the existing tabs switch between them in
JavaScript rather than navigating. That works because the two pages share
exactly one element id -- the tab itself -- and both scripts are self-contained
IIFEs that have finished running before either view is shown.

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
OUT_FILE = os.path.join(OUT_DIR, "vorframe.html")

CLOSE_SCRIPT = "</" + "script>"
ESCAPED_CLOSE = "<" + chr(92) + "/" + "script>"


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
    data = read("data", "vorframe-data.js")

    def guard(text: str) -> str:
        # a literal </script> inside inlined JS would close the tag early
        return text.replace(CLOSE_SCRIPT, ESCAPED_CLOSE)

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

    parts = [
        shell,
        '<div id="view-collection">',
        body_after_header(html),
        "</div>",
        '<div id="view-planner" hidden>',
        plan_search,
        body_after_header(plan),
        "</div>",
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
