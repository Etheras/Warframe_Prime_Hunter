# Third-party sources and attribution

VorFrame's own code is MIT licensed (see [LICENSE](LICENSE)). The data it
displays comes from the sources below, each with its own terms. This file
records what they are and what each one requires.

> Summary of the practical constraints: **non-commercial only**, **no Warframe
> or Digital Extremes logos**, and the site must be clear that it is unofficial.
> All three are satisfied by the current build.

---

## Digital Extremes Ltd. — WARFRAME

WARFRAME, all game data, item names, artwork, and related trademarks are the
property of **Digital Extremes Ltd.** VorFrame reads two publicly published
endpoints:

- <https://www.warframe.com/droptables> — the official drop tables
- <https://origin.warframe.com/PublicExport> — the official item manifest

Used under DE's [Content Policy](https://www.warframe.com/en/contentpolicy),
which permits non-commercial fan works using Warframe assets. Relevant terms:

- *"Use of Warframe assets must be non-commercial. You cannot profit from the
  direct sale of Warframe's IP."*
- *"Do not use Warframe or Digital Extremes logos without express written
  consent from Digital Extremes."*

VorFrame accordingly: charges nothing, sells nothing, carries no advertising,
uses no DE or Warframe logo or wordmark as branding, and states on every page
that it is unofficial.

DE's [Terms of Use](https://www.warframe.com/terms) also apply.

## WARFRAME Wiki — wiki.warframe.com

The Prime catalogue's categories and availability markers are parsed from
<https://wiki.warframe.com/w/Prime>.

Wiki text is licensed **[CC BY-SA](https://creativecommons.org/licenses/by-sa/3.0/)**
(Creative Commons Attribution–ShareAlike). VorFrame extracts factual values —
item names, their category, and vault-status markers — rather than reproducing
wiki prose, and attributes the wiki in the site footer and here. Any wiki text
reproduced verbatim in a derivative work must remain under CC BY-SA.

## Warframe Community Developers (WFCD)

- **[warframe-drop-data](https://github.com/WFCD/warframe-drop-data)** — MIT
  licensed. A mirror of DE's official drop tables, used as VorFrame's automatic
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

## What VorFrame does not redistribute

The generated dataset (`data/vorframe-data.js`) is deliberately **not committed**
to this repository. Every clone and every CI build downloads it fresh from the
sources above, so DE's data is never republished from here.
