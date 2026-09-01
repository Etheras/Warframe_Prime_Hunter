#!/usr/bin/env python3
"""Refuse shell commands that write source files, so the editor is used instead.

This exists because of a bug class that cost real time three separate times: a
string written through a shell heredoc arrives mangled. `\\b` became a literal
backspace byte and shipped `/^Faceoff\\x08/i` to the browser - a regex that
silently matches nothing. `\\n` became a real newline and split a JavaScript
string across two lines. A stray multibyte character rode in from a paste.

Every one of those survives `node --check` and `ast.parse`, looks correct in a
diff, and only shows up as behaviour that quietly does not happen. The Edit and
Write tools do not go through a shell parser, so the bug cannot occur there.

`tests/test_build.py` catches the damage after the fact; this refuses the path
that causes it. Wired as a PreToolUse hook on Bash and PowerShell - it reads the
hook payload on stdin and answers with a permission decision on stdout.
"""

import json
import os
import re
import sys

# Files where a mangled escape is a silent behaviour change rather than a loud
# syntax error. Data under data/, .cache/ and dist/ is generated and verified by
# the build, so writing it from a script is fine.
GUARDED = (
    re.compile(r"(^|[/\\])assets[/\\][^/\\]+\.(js|mjs|css)$", re.I),
    re.compile(r"(^|[/\\])tools[/\\][^/\\]+\.(py|ps1)$", re.I),
    re.compile(r"(^|[/\\])tests[/\\]", re.I),
    re.compile(r"\.html$", re.I),
)

# Scratch space and generated output. A redirect here is ordinary work.
EXEMPT = re.compile(
    r"(^|[/\\])(tmp|temp|scratchpad|__pycache__|node_modules)([/\\]|$)"
    r"|(^|[/\\])(\.cache|data|dist|drafts)[/\\]"
    r"|(^|[/\\])(dev[/\\])?null$",
    re.I,
)

# A redirect target, ignoring `2>`, `2>&1` and here-strings (`<<`).
REDIRECT = re.compile(r"""(?<![0-9&<>])>>?\s*(?:"([^"]+)"|'([^']+)'|([^\s;|&<>()]+))""")

# Commands whose job is to replace a file's contents.
OVERWRITERS = re.compile(
    r"""(?:^|[;|&\n(])\s*(?:sed\s+(?:-[^\s]*\s+)*-i|perl\s+-[^\s]*i|tee|"""
    r"""Set-Content|Add-Content|Out-File|Clear-Content)\b""",
    re.I,
)

# An interpreter handed its program as text rather than as a file on disk, in
# any of the three ways that happens. All three make the program text something
# a shell has to carry, which is the whole hazard: `\b` arriving as a backspace
# byte is what rule 1 exists for, and a regex is exactly the payload that
# suffers it.
#
# **The last two were missing until 2026-09-01**, and the gap was one `\b`:
# `-\s*[ceEp]*\b` needs a word character after the dash to close the boundary,
# so a BARE `-` — the ordinary way to say "the program is on stdin" — never
# matched. `python - <<'PY'` sailed through, which is the form anyone reaches
# for once a script is more than a line long. Three such writes went through the
# guard the day it was found; one of them mangled `\d` and `\/` in a regex on
# the way in, and failed loudly on an assertion by luck rather than by design.
#
# Over-matching is the real risk here, not under-matching: a guard that prompts
# on every `python -` gets switched off within the week, and `python -` with no
# write in it is common. That is why this only says *how the program arrives*
# and `WRITES` below decides whether it intends to write at all — both have to
# agree before anything is refused.
INLINE_PROGRAM = re.compile(
    r"""(?:^|[;|&\n(])\s*(?:python[0-9.]*|py|node|deno)\b\s*"""
    r"""(?:-\s*[ceEp]+\b"""        # -c, -e, -E, -p: the program is an argument
    r"""|-(?=\s|$)"""              # a bare -: the program arrives on stdin
    r"""|<)""",                    # < file: the same thing, by redirect
    re.I,
)

# Words that mean the inline program intends to write, not read.
#
# The `open(...)` half asks for a real MODE argument — a comma, then a quoted
# token made only of mode letters, one of which opens for writing. It used to be
# `open\s*\([^)]*['"][wax]`, which needed only a quote followed by w, a or x
# anywhere inside the call, and that matched **`open('assets/plan.js')`** on the
# `'a` of `assets`. A pure read, refused.
#
# That mattered nowhere until INLINE_PROGRAM learnt about stdin programs on
# 2026-09-01, because until then almost nothing reached this regex; afterwards it
# would have prompted on the commonest probe in the project. Widening one half of
# a two-part test is what exposes a loose pattern in the other.
WRITES = re.compile(
    r"""open\s*\([^)]*,\s*['"][rwaxbt+]*[wax][rwaxbt+]*['"]"""
    r"""|write_text|writeFile|WriteAllText|\.write\(|>\s*['"]""",
    re.I,
)

# Anything that looks like a path, so an inline program's targets are visible.
PATHISH = re.compile(r"""['"]([^'"\n]*[/\\][^'"\n]*)['"]|(\b(?:assets|tools|tests)[/\\][^\s'";|&)]+)""")


def targets(command):
    """Every path this command looks like it intends to write."""
    found = []

    for match in REDIRECT.finditer(command):
        found.append(next(g for g in match.groups() if g is not None))

    if OVERWRITERS.search(command):
        found += [g for pair in PATHISH.findall(command) for g in pair if g]

    if INLINE_PROGRAM.search(command) and WRITES.search(command):
        found += [g for pair in PATHISH.findall(command) for g in pair if g]

    return found


def blocked(command):
    """The guarded paths this command would write, in the order they appear."""
    hits = []
    for raw in targets(command):
        path = raw.strip().strip("\"'")
        if not path or EXEMPT.search(path):
            continue
        if any(pattern.search(path) for pattern in GUARDED) and path not in hits:
            hits.append(path)
    return hits


def main():
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return 0  # Never let a malformed payload stall the session.

    command = (payload.get("tool_input") or {}).get("command") or ""
    hits = blocked(command)
    if not hits:
        return 0

    which = ", ".join(hits)
    json.dump(
        {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": (
                    f"Writing {which} through a shell is blocked by "
                    "tools/guard_shell_writes.py. A shell mangles escapes on the way in - "
                    "\\b has arrived as a backspace byte and \\n as a real newline here "
                    "before, and both survive every syntax check. Use the Edit or Write "
                    "tool, which does not pass the text through a shell parser. "
                    "(Reading these files is fine - only redirects and in-place writes "
                    "are refused.)"
                ),
            }
        },
        sys.stdout,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
