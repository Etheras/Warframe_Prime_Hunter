# Third-party sources and attribution

Warframe Prime Hunter's own code is MIT licensed (see [LICENSE](LICENSE)). The data it
displays comes from the sources below, each with its own terms. This file
records what they are and what each one requires.

## Authorship — written by a generative AI

Effectively all of this project's code, tests and documentation was written by
**Claude** (Anthropic), directed and reviewed by a human owner who made the
design decisions. The [README](README.md) says so at the top, and says what the
project does about it.

Two things worth recording here rather than only there:

- **It changes what the copyright is worth, possibly to nothing.** Several
  jurisdictions grant protection only to works with sufficient *human*
  authorship — the US Copyright Office has been explicit that purely
  machine-generated material is not protectable, with protection extending only
  to a human's own creative contributions such as selection, arrangement and
  modification. How much of this codebase clears that bar is genuinely unsettled
  and untested, so **the MIT grant may cover less than it appears to.** It is
  offered in good faith and imposes no obligation the law does not support. If
  you need certainty about reusing this, do not rely on the licence file alone.
- **No model runs in the pipeline.** An AI wrote the parsers; none is invoked
  when they run. Every value shown is derived deterministically from the sources
  below, which is a deliberate rule of the project rather than an accident — see
  [`PROJECT.md §2`](PROJECT.md).

This is a description, not legal advice, and the same caveat applies as further
down: anyone publishing an instance should satisfy themselves it fits their
circumstances.

> Summary of the practical constraints: **non-commercial only**, **no Warframe
> or Digital Extremes logos**, and the site must be clear that it is unofficial.
> All three are satisfied by the current build.

---

## Digital Extremes Ltd. — WARFRAME

WARFRAME, all game data, item names, artwork, and related trademarks are the
property of **Digital Extremes Ltd.** Warframe Prime Hunter reads two publicly published
endpoints:

- <https://www.warframe.com/droptables> — the official drop tables
- <https://origin.warframe.com/PublicExport> — the official item manifest

Used under DE's [Content Policy](https://www.warframe.com/en/contentpolicy),
which permits non-commercial fan works using Warframe assets. Relevant terms:

- *"Use of Warframe assets must be non-commercial. You cannot profit from the
  direct sale of Warframe's IP."*
- *"Do not use Warframe or Digital Extremes logos without express written
  consent from Digital Extremes."*

Warframe Prime Hunter accordingly: charges nothing, sells nothing, carries no advertising,
uses no DE or Warframe logo or wordmark as branding, and states on every page
that it is unofficial.

DE's [Terms of Use](https://www.warframe.com/terms) also apply.

### Serving artwork rather than hotlinking it

`build_data.py --with-images` downloads item artwork and the site then serves it
itself. That is deliberate: hotlinking sends every visitor's IP address to a third
party, which a tool that otherwise keeps everything local has no business doing.

Note that `cdn.warframestat.us` is **WFCD's** CDN, not Digital Extremes'. DE host
none of this and have no bandwidth either way, so hotlinking is not a courtesy to
them — it pushes the cost onto a volunteer community project, once per visitor per
instance. Serving our own copy is the better manners as well as the better privacy.

It does mean this project **redistributes DE's artwork** rather than merely linking
to it. DE's copyright in the images is the same either way; what changes is the
form of use. It is
covered by the same Content Policy allowance for non-commercial fan works, and the
conditions it depends on are the ones already listed above — nothing is charged for,
nothing is sold, there is no advertising, no DE or Warframe logo is used as branding,
and every page says the project is unofficial. **If any of those ever stops being
true, this arrangement stops being covered.**

The artwork itself is not committed to this repository (see `.gitignore`); each
installation downloads its own copy from `cdn.warframestat.us`.

## Privacy

No account, no cookies, no analytics, no third-party requests. Your collection lives
in your browser's `localStorage` and is never transmitted — the server has no idea
what you own, and could not tell you if asked.

The one piece of personal data touched is the visitor's IP address, which `serve.py`
uses transiently for rate limiting. It is keyed-hashed with a salt generated at
start-up and held only in memory, never written to disk, and discarded when the
process exits, so buckets cannot be linked back to an address or correlated across
restarts. The basis is legitimate interest in the security and availability of the
service (GDPR Art. 6(1)(f), with Recital 49 naming network and information security
explicitly). No request log is kept: shutdown prints totals only.

This is a description of what the software does, not legal advice. Anyone publishing
an instance is the data controller for it and should satisfy themselves it fits their
circumstances.

## WARFRAME Wiki — wiki.warframe.com

The Prime catalogue's categories and availability markers are parsed from
<https://wiki.warframe.com/w/Prime>.

Wiki text is licensed **[CC BY-SA](https://creativecommons.org/licenses/by-sa/3.0/)**
(Creative Commons Attribution–ShareAlike). Warframe Prime Hunter extracts factual values —
item names, their category, and vault-status markers — rather than reproducing
wiki prose, and attributes the wiki in the site footer and here. Any wiki text
reproduced verbatim in a derivative work must remain under CC BY-SA.

## Warframe Community Developers (WFCD)

- **[warframe-drop-data](https://github.com/WFCD/warframe-drop-data)** — MIT
  licensed. A mirror of DE's official drop tables, used as Warframe Prime Hunter's automatic
  fallback when warframe.com is unreachable.
- **[warframe-status](https://github.com/WFCD/warframe-status)** —
  Apache-2.0 licensed. Powers `api.warframestat.us`, used for item metadata,
  component lists, artwork filenames, and the live Prime Resurgence rotation
  from the game worldstate.
- **`cdn.warframestat.us`** — serves the item artwork shown on the cards. The
  images themselves remain Digital Extremes' property.

Both projects are used unmodified over their public HTTP endpoints; their
copyright notices are preserved by this file.

---

## What Warframe Prime Hunter does not redistribute

The generated dataset (`data/prime-data.js`) is deliberately **not committed**
to this repository. Every clone and every CI build downloads it fresh from the
sources above, so DE's data is never republished from here.
