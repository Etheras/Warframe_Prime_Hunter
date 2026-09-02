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

import hashlib
import json
import os
import re
import sys
import tempfile

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


# ── the second half: what actually changed ───────────────────────────────
#
# **Everything above is a blacklist, and a blacklist of shell syntax cannot be
# finished.** A sweep on 2026-09-02 found ten ways round it in an afternoon -
# `cd assets && sed -i app.js`, `cp` from the scratchpad, `1>`, `sed
# --in-place`, `python -u -c`, the full `node.exe` path this project's own
# CLAUDE.md recommends - and there is no reason to think that was the last ten.
# It is trying to statically analyse an arbitrary shell language, which does not
# terminate.
#
# So the owner asked the right question on 2026-09-03: should it not be a
# whitelist? The answer is yes, but not the obvious inversion. Whitelisting
# *commands* leaves the other half of the problem untouched - `PATHISH` still has
# to work out which paths a command names, and half the holes above are there
# rather than in the verb list. `cd assets && sed -i app.js` names no guarded
# path at all, so no verb whitelist would see it either.
#
# **The inversion that works is to stop parsing intent and check the effect.**
# Hash the guarded files before the command and after it. Nothing is enumerated,
# so every mechanism is covered - known, unknown, `cp`, `dd`, a Python script, a
# binary compiled thirty seconds ago - because none of them can change a file
# without changing its hash.
#
# Two honest limits. It **detects rather than prevents**: the bytes have landed
# by the time this runs. That is a real downgrade from a refusal, and it is
# acceptable only because the failure this rule exists for is *silent* - `\b`
# arriving as a backspace byte and surviving every syntax check - and loud
# detection one second later, while the command is still on screen and `git
# diff` is one keystroke away, defeats a silent failure nearly as well as
# prevention does. And it cannot see a change made by something other than the
# tool it is wired to.
#
# The snapshot is taken in the PreToolUse pass, so an Edit or Write between two
# shell commands is already in the baseline and never reported. Only a change
# that happens *between* the two passes of one command is attributed to it,
# which is the whole point.
#
# Measured on this repository: 24 guarded files, 1.2 MB, 1.6 ms to SHA-256 the
# lot. Cheap enough to hash everything every time rather than track mtimes,
# which is both simpler and strictly harder to fool.

def project_root() -> str:
    """The repo. `CLAUDE_PROJECT_DIR` when the harness sets it, else our parent."""
    env = os.environ.get("CLAUDE_PROJECT_DIR")
    if env and os.path.isdir(env):
        return os.path.abspath(env)
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# Never walked. Generated output and third-party trees, all either exempt by the
# rule above or too big to be worth the stat calls.
SKIP_DIRS = {".git", ".claude", "node_modules", "__pycache__",
             ".cache", "data", "dist", "drafts", "test-results", "assets/img"}


def guarded_files(root: str) -> list:
    """Every file the rule protects, repo-relative, sorted."""
    found = []
    for base, dirs, names in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in names:
            rel = os.path.relpath(os.path.join(base, name), root).replace("\\", "/")
            if EXEMPT.search(rel):
                continue
            if any(pattern.search(rel) for pattern in GUARDED):
                found.append(rel)
    return sorted(found)


def fingerprint(root: str) -> dict:
    """`{path: sha256}` for the guarded set. Unreadable files are recorded as such
    rather than skipped, so a file that becomes unreadable is itself a change."""
    out = {}
    for rel in guarded_files(root):
        try:
            with open(os.path.join(root, rel), "rb") as fh:
                out[rel] = hashlib.sha256(fh.read()).hexdigest()
        except OSError as exc:
            out[rel] = f"unreadable: {exc.__class__.__name__}"
    return out


def snapshot_file(session: str) -> str:
    """One file per session, in the OS temp dir - never in the repo, which this
    module exists to keep a shell out of."""
    safe = re.sub(r"[^A-Za-z0-9_-]", "", str(session))[:64] or "nosession"
    return os.path.join(tempfile.gettempdir(), f"wfph-guard-{safe}.json")


def verify(root: str, session: str) -> int:
    """PostToolUse: report any guarded file the command just changed."""
    path = snapshot_file(session)
    try:
        with open(path, "r", encoding="utf-8") as fh:
            before = json.load(fh)
    except (OSError, ValueError):
        return 0            # no baseline (first call, or a denied one) - nothing to say

    after = fingerprint(root)
    # Rewrite the baseline either way, so one change is reported once rather
    # than on every command for the rest of the session.
    try:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(after, fh)
    except OSError:
        pass

    changed = sorted(k for k in set(before) | set(after)
                     if before.get(k) != after.get(k))
    if not changed:
        return 0

    which = ", ".join(changed)
    json.dump(
        {
            "decision": "block",
            "reason": (
                f"That shell command changed {which}, which hard rule 1 says must "
                "not be written through a shell. A shell mangles escapes on the "
                "way in - \\b has arrived as a backspace byte and \\n as a real "
                "newline here before, and both survive every syntax check, so the "
                "damage is silent. This is checked by comparing file hashes before "
                "and after, so it sees every mechanism rather than a list of them. "
                "Check `git diff` on those paths now, while you still know what "
                "ran, and redo the edit with the Edit or Write tool."
            ),
        },
        sys.stdout,
    )
    return 0


def main():
    post = "--verify" in sys.argv[1:]
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return 0  # Never let a malformed payload stall the session.

    root = project_root()
    session = payload.get("session_id") or "nosession"

    if post:
        return verify(root, session)

    # Take the baseline first: a command denied below never runs, so its
    # snapshot is simply never compared, and the next command overwrites it.
    try:
        with open(snapshot_file(session), "w", encoding="utf-8") as fh:
            json.dump(fingerprint(root), fh)
    except OSError:
        pass                # a snapshot we could not write is one we will not compare

    # `str()` rather than `or ""`: a `command` that is not a string used to reach
    # the regexes and raise, and a hook that raises is a hook that fails OPEN.
    command = str((payload.get("tool_input") or {}).get("command") or "")
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
