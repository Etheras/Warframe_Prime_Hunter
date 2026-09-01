#!/usr/bin/env python3
"""
Build the GitHub wiki out of the documentation already in this repository.

    python tools/wiki.py            # write dist/wiki/
    python tools/wiki.py --check    # verify every source section still exists

The wiki is a second place documentation can live, and this project has been
bitten more than once by a fact that was true in one place and stale in another -
a tooltip that went on claiming the app could not see fissures for ten days after
it could, a comment describing a UI element that had been replaced. A
hand-written wiki would be the worst version of that, because nothing in the
suite would ever look at it.

So nothing here is written by hand. Every page is assembled from sections of
README.md, PROJECT.md and TODO.md, and the pages carry a banner saying so. Edit
the repository; the wiki follows on the next full build.

**A missing section is a hard error, not a thin page.** Headings get reworded,
and the failure mode that matters is the quiet one: a page that silently loses
half its content and stays published for months. `--check` runs in the test
suite, so renaming a heading breaks the build in front of whoever renamed it.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "dist", "wiki")

REPO = "Etheras/Warframe_Prime_Hunter"
BLOB = f"https://github.com/{REPO}/blob/main/"
SITE = "https://etheras.github.io/Warframe_Prime_Hunter/"

# Files a link can point at. Anything else relative is left alone, because a
# link this does not understand is better broken loudly on GitHub than silently
# rewritten to somewhere that does not exist.
LINKABLE = ("README.md", "PROJECT.md", "TODO.md", "STYLE.md", "NOTICE.md",
            "LICENSE", "CHANGELOG.md",
            "assets/", "tools/", "tests/", "data/", "index.html", "plan.html")


# ── the manifest ──────────────────────────────────────────────────────────
# (page file, page title, [(source doc, heading text)]). Heading text is
# matched exactly against a markdown heading of any level, minus the hashes.
PAGES = [
    ("Home.md", "Warframe Prime Hunter", []),          # assembled by hand below
    ("Getting-started.md", "Getting started", [
        ("README.md", "What you need"),
        ("README.md", "Getting it"),
        ("README.md", "Setup"),
        ("README.md", "Opening the site"),
    ]),
    ("Using-it.md", "Using it", [
        ("README.md", "The collection"),
        ("README.md", "The planner"),
        ("README.md", "Backing up your progress"),
    ]),
    ("Keeping-it-current.md", "Keeping it current", [
        ("README.md", "Keeping it up to date"),
        ("README.md", "Taking it with you"),
    ]),
    ("Where-the-data-comes-from.md", "Where the data comes from", [
        ("PROJECT.md", "6. Data sources"),
    ]),
    ("How-the-ranking-works.md", "How the ranking works", [
        ("PROJECT.md", "Two lists, two questions, never one score"),
        ("PROJECT.md", "A bounty's rotation is a wall clock, not a depth"),
        ("PROJECT.md", "Nodes that are the same bet are one row"),
        ("PROJECT.md", "The fissure marks the ranking; it is never a list of its own"),
        ("PROJECT.md", "Effort is the player's to give, and blank until they do"),
        ("PROJECT.md", "One deliberate thumb on the scale, and only one"),
    ]),
    ("Status.md", "Status", [
        ("TODO.md", "What is open, at a glance"),
    ]),
]


# A closing note for pages whose source text points somewhere the wiki does not
# go. The status overview says "each one is a ### heading further down", and
# further down is TODO.md, not this page - a promise the wiki cannot keep unless
# it says where the rest is.
TAILS = {
    "Status.md":
        "\n\n---\n\nEach row above is a heading in "
        f"[`TODO.md`]({BLOB}TODO.md), where the reasoning, the measurements and "
        "the arguments against live. This page carries the index only.\n",
}


def read(name: str) -> str:
    with open(os.path.join(ROOT, name), encoding="utf-8") as fh:
        return fh.read()


def section(doc: str, heading: str) -> str:
    """
    One heading and everything under it, up to the next heading of the same
    level or higher. Raises if the heading is not there - see the module
    docstring for why that is a build failure rather than a shrug.
    """
    lines = doc.split("\n")
    start = level = None
    for i, line in enumerate(lines):
        m = re.match(r"^(#{1,6})\s+(.*?)\s*$", line)
        if m and m.group(2) == heading:
            start, level = i, len(m.group(1))
            break
    if start is None:
        raise KeyError(heading)

    end = len(lines)
    for i in range(start + 1, len(lines)):
        m = re.match(r"^(#{1,6})\s+", lines[i])
        if m and len(m.group(1)) <= level:
            end = i
            break
    return "\n".join(lines[start:end]).rstrip()


def reheading(text: str) -> str:
    """
    Shift a section's headings so its top one sits at `##`, under the page title
    GitHub renders from the filename. `PROJECT.md` keeps its chapters at `##`
    and its arguments at `###`; lifted onto a page of their own they would
    otherwise open at a level below a heading that is not there.

    Fenced code is skipped, because a `#` at the start of a line inside a fence
    is a shell comment and not a heading — and this project's docs are full of
    them.
    """
    lines, fenced, levels = text.split("\n"), False, []
    for line in lines:
        if line.startswith("```"):
            fenced = not fenced
        elif not fenced:
            m = re.match(r"^(#{1,6})\s+\S", line)
            if m:
                levels.append(len(m.group(1)))
    if not levels:
        return text

    # No early return when the shift is zero: the loop also strips chapter
    # numbers, and a section that already sits at `##` still carries one.
    shift = 2 - min(levels)

    out, fenced = [], False
    for line in lines:
        if line.startswith("```"):
            fenced = not fenced
            out.append(line)
            continue
        m = re.match(r"^(#{1,6})(\s+)(\S.*)$", line) if not fenced else None
        if m:
            level = max(1, min(6, len(m.group(1)) + shift))
            # "6. Data sources" is a chapter number in PROJECT.md and nothing at
            # all on a page of its own, where the wiki supplies the title
            text_ = re.sub(r"^\d+\.\s+", "", m.group(3))
            out.append("#" * level + m.group(2) + text_)
        else:
            out.append(line)
    return "\n".join(out)


def absolutise(text: str) -> str:
    """
    Repo-relative links point at files the wiki does not contain, so they are
    rewritten to the repository on github.com. Anchors that were internal to
    one long README become anchors on that file, which is where the section
    they name actually is.

    Code spans are left alone on purpose: `PROJECT.md §7` is a citation telling
    a reader where the argument lives, not a link, and turning every mention
    into a hyperlink makes the prose unreadable.
    """
    def link(m):
        label, target = m.group(1), m.group(2)
        if target.startswith(("http://", "https://", "mailto:")):
            return m.group(0)
        if target.startswith("#"):
            return f"[{label}]({BLOB}README.md{target})"
        if target.startswith(LINKABLE):
            return f"[{label}]({BLOB}{target})"
        return m.group(0)

    return re.sub(r"\[([^\]]*)\]\(([^)]+)\)", link, text)


def banner(sources: list) -> str:
    named = sorted({s for s, _ in sources})
    where = ", ".join(f"[`{n}`]({BLOB}{n})" for n in named)
    return ("> **This page is generated.** It is assembled from " + where +
            " in the repository by [`tools/wiki.py`]" + f"({BLOB}tools/wiki.py)"
            " and rewritten on every full build.\n>\n"
            "> **Edits made here are overwritten.** Change the source file and open a\n"
            "> pull request instead — that way one fact has one home.\n")


def quote_blocks(text: str) -> list:
    """
    The runs of blockquote in a chunk of markdown, unquoted, in order.

    README opens with two of them - the notice that an AI wrote this, and the
    one thing that can reach the internet - and both belong on a public landing
    page. They are taken by shape rather than by heading because being a
    blockquote is what makes them notices rather than chapters; the heading
    inside the first one is not a section of the document at all.
    """
    blocks, current = [], []
    for line in text.split("\n"):
        if line.startswith(">"):
            current.append(re.sub(r"^>\s?", "", line))
        elif current:
            blocks.append("\n".join(current).strip())
            current = []
    if current:
        blocks.append("\n".join(current).strip())
    return blocks


def home(stats: dict) -> str:
    """
    The landing page, and the only one with no source section of its own: it is
    the project's own pitch, its two standing notices, and a map of everything
    else. All of it is lifted from README rather than rewritten, so there is
    still exactly one copy of every sentence.
    """
    readme = read("README.md")
    head = readme.split("\n## ")[0]                # above the first section

    # A standing notice is a blockquote that carries its own `###` heading.
    #
    # Found by shape, never by wording. This briefly matched the literal string
    # "### Written by a generative AI" on 2026-09-01, which is a promise that the
    # sentence will never be reworded - and the owner was right to reject it: a
    # build must not break because somebody improved a paragraph.
    #
    # The distinction the heading draws is real. README carries ten blockquotes
    # and most are asides - how to repoint an old clone, why the dataset is not
    # committed, that `file://` may not persist storage. Those are tips beside
    # the step they belong to. A notice is different in kind: it is about the
    # project rather than about the task in hand, it stands on its own, and it is
    # the sort of thing a reader is entitled to find without hunting. Giving one
    # a heading is how the document says which it is.
    #
    # Only these fail the build. An aside going missing is an edit; a disclaimer,
    # a privacy notice or a legal notice going missing is a promise withdrawn,
    # and Home.md is where the public reads them.
    notices = [q for q in quote_blocks(readme)
               if any(l.startswith("### ") for l in q.split("\n"))]
    if not notices:
        raise SystemExit(
            "wiki: README carries no standing notice - Home.md is built from "
            "them. A notice is a blockquote with its own `### ` heading; give "
            "the disclaimer, privacy and legal blocks one and they are found "
            "again, wherever in the document they sit.")
    # (title, body) each, the heading lifted out so this page can promote it to
    # a section of its own.
    def split_notice(q):
        head = next(l for l in q.split("\n") if l.startswith("### "))
        body = "\n".join(l for l in q.split("\n") if not l.startswith("### "))
        return head[4:].strip(), body.strip()

    notices = [split_notice(q) for q in notices]

    # what is left between the two notices, which is the description itself
    pitch = "\n".join(l for l in head.split("\n")[1:]
                      if not l.startswith((">", "#", "---"))).strip()

    nav = "\n".join(
        f"- **[{title}]({file[:-3]})**" for file, title, srcs in PAGES if srcs)

    return (f"{banner([('README.md', '')])}\n"
            f"{absolutise(pitch)}\n\n"
            f"**[Open the live site]({SITE})** · "
            f"**[Browse the code](https://github.com/{REPO})**\n\n"
            f"---\n\n## Where to go\n\n{nav}\n\n"
            # Each notice under its own heading, taken from the README. The
            # titles were written out here until 2026-09-01, which is the same
            # hard-coding one level up: this page would have gone on announcing
            # "Written by a generative AI" over whatever the block had become.
            # The document owns the wording; this owns the layout.
            + "".join(f"---\n\n## {title}\n\n{absolutise(body)}\n\n"
                      for title, body in notices)
            + f"---\n\n{stats_block(stats)}")


def stats_block(stats: dict) -> str:
    if not stats:
        return ("## The dataset\n\nNo dataset was present when this page was "
                "built, so there are no figures to show.\n")
    m = stats["meta"]
    farmable = sum(1 for i in stats["items"] if i["flags"]["farmable"])
    warframes = sum(1 for i in stats["items"] if i["category"] == "Warframe")
    live = sum(1 for r in stats["relics"].values() if not r.get("vaulted"))
    return (
        "## The dataset, as last built\n\n"
        "| | |\n|---|---|\n"
        f"| Primes catalogued | {m['itemCount']} ({warframes} Warframes) |\n"
        f"| Farmable right now | {farmable} |\n"
        f"| In Prime Resurgence | {sum(1 for i in stats['items'] if i['flags']['resurgence'])} |\n"
        f"| Relics known | {len(stats['relics'])} ({live} currently dropping) |\n"
        f"| Drop data from | {m['dropSource']} |\n\n"
        "Read from Digital Extremes' published drop tables, and rewritten here\n"
        "whenever they move. Live Void Fissures are deliberately not among these\n"
        "figures: they turn over every hour or two, so a number on a wiki page\n"
        "would be wrong before it was read. The site shows them live.\n")


def sidebar() -> str:
    lines = ["### Warframe Prime Hunter", "", "- **[Home](Home)**"]
    lines += [f"- [{title}]({file[:-3]})" for file, title, srcs in PAGES if srcs]
    lines += ["", "---", "", f"- [Live site]({SITE})",
              f"- [Repository](https://github.com/{REPO})",
              f"- [Open work]({BLOB}TODO.md)"]
    return "\n".join(lines) + "\n"


def footer() -> str:
    return (f"_Generated from [the repository](https://github.com/{REPO}) by "
            f"[`tools/wiki.py`]({BLOB}tools/wiki.py). Edits made here are "
            f"overwritten — change the source and the wiki follows._\n")


def build(check_only: bool = False) -> int:
    missing = []
    pages = {}
    stats = {}
    try:
        with open(os.path.join(ROOT, "data", "prime-data.json"), encoding="utf-8") as fh:
            stats = json.load(fh)
    except (OSError, ValueError):
        pass                       # a clone with no data still builds a wiki

    for file, title, sources in PAGES:
        if not sources:
            continue
        parts = []
        for doc_name, heading in sources:
            try:
                parts.append(reheading(section(read(doc_name), heading)))
            except KeyError:
                missing.append(f"{doc_name}: {heading}")
        pages[file] = (f"# {title}\n\n{banner(sources)}\n" +
                       absolutise("\n\n".join(parts)) + TAILS.get(file, "") + "\n")

    if missing:
        print("wiki: these sections are named in tools/wiki.py and no longer exist:")
        for m in missing:
            print(f"  - {m}")
        print("\nRename them back, or update PAGES. A page is not allowed to lose\n"
              "half its content quietly.")
        return 1

    pages["Home.md"] = home(stats)
    pages["_Sidebar.md"] = sidebar()
    pages["_Footer.md"] = footer()

    if check_only:
        print(f"wiki: {len(pages)} pages, every source section present")
        return 0

    os.makedirs(OUT_DIR, exist_ok=True)
    for name, body in sorted(pages.items()):
        with open(os.path.join(OUT_DIR, name), "w", encoding="utf-8", newline="\n") as fh:
            fh.write(body)
        print(f"  {name:34} {len(body):>7,} bytes")
    print(f"wiki: {len(pages)} pages -> dist/wiki/")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--check", action="store_true",
                    help="verify every source section exists, write nothing")
    return build(ap.parse_args().check)


if __name__ == "__main__":
    sys.exit(main())
