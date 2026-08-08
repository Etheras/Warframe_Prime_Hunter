#!/usr/bin/env python3
"""
Fold the whole site into one self-contained .html file.

The result has the stylesheet, the script and the dataset inlined, so it is a
single file you can copy to a USB stick, email to yourself, or drop on any
machine with a browser. No Python, no server, no internet needed to open it.

    python tools/bundle.py            -> dist/vorframe.html

Only the item artwork still comes from the network; without it the cards fall
back to a placeholder glyph and everything else keeps working.
"""

from __future__ import annotations

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "dist")
OUT_FILE = os.path.join(OUT_DIR, "vorframe.html")


def read(*parts: str) -> str:
    path = os.path.join(ROOT, *parts)
    if not os.path.exists(path):
        raise SystemExit(f"missing {path} — run tools/build_data.py first")
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def main() -> int:
    html = read("index.html")
    css = read("assets", "styles.css")
    js = read("assets", "app.js")
    data = read("data", "vorframe-data.js")

    # </script> anywhere inside inlined JS would close the tag early
    def guard(text: str) -> str:
        return text.replace("</script>", "<\\/script>")

    html = html.replace(
        '<link rel="stylesheet" href="assets/styles.css">',
        "<style>\n" + css + "\n</style>",
    )
    html = html.replace(
        '<script src="data/vorframe-data.js"></script>',
        "<script>\n" + guard(data) + "\n</script>",
    )
    html = html.replace(
        '<script src="assets/app.js"></script>',
        "<script>\n" + guard(js) + "\n</script>",
    )

    # Nothing external should be left behind. Template placeholders like
    # src="${esc(it.image)}" live inside the inlined script, not the markup.
    leftovers = {
        m for m in re.findall(r'(?:src|href)="(?!data:|https?:|#)([^"]+)"', html)
        if "${" not in m
    }
    if leftovers:
        print("  ! still referencing local files:", ", ".join(sorted(leftovers)))

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as fh:
        fh.write(html)

    size = os.path.getsize(OUT_FILE) / 1024 / 1024
    print(f"wrote dist/vorframe.html ({size:.2f} MB) — open it anywhere")
    return 0


if __name__ == "__main__":
    sys.exit(main())
