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

**Since 2026-08-27 the artwork comes from Digital Extremes themselves.** Their
`ExportManifest.json` maps each item's `uniqueName` to a `textureLocation`, and
`content.warframe.com/PublicExport` + that path is the picture — covering all 167
of the catalogue. So the images are now first party, like the drop tables and the
export beside them.

That also changes who pays for a hotlink, and it is worth being clear that the
change is not a licence to stop caring. DE serve these behind a content hash with
a `max-age` of about a year, which is as close to free as a request gets; WFCD's
CDN did not, and every hotlinked image was a cost pushed onto a volunteer project
once per visitor per instance. `--with-images` remains the right build for
anything long-lived either way, because the privacy argument is unchanged: a
hotlink sends every visitor's IP address to somebody else.

`cdn.warframestat.us` is **WFCD's** CDN, not Digital Extremes', and it remains the
fallback for a build that cannot read DE's manifest.

It does mean this project **redistributes DE's artwork** rather than merely linking
to it. DE's copyright in the images is the same either way; what changes is the
form of use. It is
covered by the same Content Policy allowance for non-commercial fan works, and the
conditions it depends on are the ones already listed above — nothing is charged for,
nothing is sold, there is no advertising, no DE or Warframe logo is used as branding,
and every page says the project is unofficial. **If any of those ever stops being
true, this arrangement stops being covered.**

The artwork itself is not committed to this repository (see `.gitignore`); each
installation downloads its own copy, from `content.warframe.com` where DE's
texture manifest can be read and from `cdn.warframestat.us` when it cannot.

## Privacy

No account, no cookies, no analytics. Your collection lives in your browser's
`localStorage` and is never transmitted — the server has no idea what you own, and
could not tell you if asked.

**"No third-party requests" is true of a build with local artwork, and was stated
flat here until 2026-09-01.** It is not true of the two artefacts most people
read: the published site and the standalone download both load 167 images from
whichever host the build recorded — `content.warframe.com` where DE's texture
manifest could be read, `cdn.warframestat.us` where it could not, and that one
redirects on to `raw.githubusercontent.com`. Those hosts therefore see a
visitor's address and which items they looked at, and nothing else; the
collection never leaves the browser either way. The site's own footer names the
hosts the build it came from actually uses, read from `meta.sources.imageHosts`
rather than asserted, so the page and this file cannot drift apart again. Build
with `--with-images` and there are none for artwork.

**One third-party request survives every build, including that one, since
2026-09-08.** To show which Void Fissures are running now, the page itself asks
`https://api.warframestat.us/pc/fissures` every two minutes while it is open.
Void Fissures expire in an hour or two, so a list fixed at build time is
routinely a list of places that have already closed — the feature does not work
without a live read, and no first-party route exists for it: Digital Extremes'
own worldstate sends no `Access-Control-Allow-Origin` header at all, so a browser
cannot read it whatever this project does.

WFCD therefore see a visitor's address and that they are running this tool, and
nothing else — the collection is never transmitted. The poll honours the
`Cache-Control: max-age=120` WFCD's own response declares, **on every path that
can reach it**: the two-minute timer, and the check made when a reader returns
to the tab. That second one is stated because it was the gap — until 2026-09-09
returning to the tab asked immediately, so alt-tabbing between the game and the
planner could produce many requests inside one declared window. It is now
refused in the same place the timer is. The site footer names the host on every
page and every build, unconditionally, because unlike artwork there is no
configuration that turns it off.

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

**WFCD is not Digital Extremes, and says so itself.** Their own description reads
*"Tenno who provide developed tools that people can use for their own projects or
gameplay without infringing on aspects of Warframe. **Not affiliated with DE.**"*
It is a community organisation, on GitHub since December 2016, reachable at
`devs@warframestat.us`.

**The data is DE's; the parsing and the hosting are WFCD's.** That distinction is
easy to lose and worth stating plainly, because the two halves fail separately.
`warframe-drop-data`'s own README says the data *"is parsed from Digital Extremes
official drop data website"* and links every dataset back to DE's drop-table page
as its source — so the numbers are DE's, published by DE, and what WFCD add is a
machine-readable shape and a server to fetch it from. (One exception they name:
their syndicate data is scraped from the wiki rather than from DE's drop site.)

So "third party" here is a claim about the **route**, never about the origin, and
it is load-bearing rather than pedantic. On 2026-08-24 the WFCD worldstate proxy
began returning 404 and stayed down for days while DE's own worldstate was
served, complete, the entire time.

- **[warframe-drop-data](https://github.com/WFCD/warframe-drop-data)** — **MIT**
  licensed, © 2017 Christopher Kaster. DE's official drop tables, parsed into
  JSON, used as Warframe Prime Hunter's automatic fallback when warframe.com is
  unreachable.
- **[warframe-items](https://github.com/WFCD/warframe-items)** — **MIT**
  licensed, © 2017 Kaptard. Credited for the **fallback** artwork path only.
  `cdn.warframestat.us/img/<file>` answers **301** to
  `raw.githubusercontent.com/wfcd/warframe-items/master/data/img/<file>`, so a
  build that cannot read DE's texture manifest ends up loading pictures from
  this repository. Since 2026-08-27 the ordinary path does not: artwork comes
  from Digital Extremes directly (see above), and this is reached only when
  their manifest is unavailable.
- **[warframe-status](https://github.com/WFCD/warframe-status)** —
  **MIT** licensed, © 2017 nspacestd. Powers `api.warframestat.us`, used for item metadata,
  component lists, artwork filenames, and four reads of the game worldstate: the
  live Prime Resurgence rotation (`/pc/vaultTrader`), which bounties are on offer
  and therefore which rotation letter is live (`/pc/syndicateMissions`), which
  limited-time events are running (`/pc/events`), and the Void Fissures open right
  now (`/pc/fissures`).

  This entry used to say Digital Extremes *"publish no working endpoint for"*
  those four. **That was wrong**, and was corrected on 2026-08-27:
  `api.warframe.com/cdn/worldState.php` serves all of them, first party, and had
  been doing so throughout. Two DE hosts that do 404 had been read as proving the
  general case. `TODO.md` tracks moving to it; WFCD stays as the fallback.
- **`cdn.warframestat.us`** — serves the item artwork shown on the cards. The
  images themselves remain Digital Extremes' property.

- **[warframe-worldstate-data](https://github.com/WFCD/warframe-worldstate-data)**
  — **MIT** licensed, © 2016 Matej Voboril. **The one thing vendored rather than
  fetched**, and the only WFCD material copied into this repository.

  `tools/proxima_nodes.py` carries 42 Railjack node names derived from their
  `data/solNodes.json`, with the full MIT notice reproduced in that file as the
  licence requires. Digital Extremes publish the Railjack fissures as bare ids —
  `CrewBattleNode522` — and publish no name for them anywhere: every DE manifest
  this project caches was decompressed and searched on 2026-09-08 and the ids
  occur in one file only, the worldstate. The wiki names the nodes and has zero
  occurrences of `CrewBattleNode` site-wide, so it cannot supply the join either.
  The mapping is not derivable from any first-party source; it exists because
  people wrote it down.

  Taken narrowly: their Railjack subset only, 42 of 452 nodes, and only the name
  of each — the `enemy` and `type` fields beside it are neither used nor
  reproduced. Two names are reconciled to Digital Extremes' own drop tables
  (`Lu-yan` → `Lu-Yan`, `Sambir Cloud` → `Sabmir Cloud`) because a fissure only
  reaches a reader if it matches the node the planner ranks, and the planner's
  names come from DE. `tools/proxima_nodes.py` records both.

Everything else from WFCD is used unmodified over their public HTTP endpoints,
and every copyright notice above is preserved by this file.

**This paragraph used to read "No WFCD code is vendored, copied or depended on",
and it named the exception in advance**: `PROJECT.md §2` requires the owner's
approval first and a licence reading second before a mapping table is taken
verbatim. Both happened on 2026-09-08, in that order — the owner approved after
being shown that no first-party route exists, and the MIT terms were read in full
before anything was copied. The rule worked as written; the sentence it protected
is the one that had to change.

---

## warframe.market

**A third source tier, and the first that is neither Digital Extremes nor WFCD.**
Added 2026-09-08. Warframe Prime Hunter reads two public endpoints to show what a
spare Prime part is worth in Platinum:

- <https://api.warframe.market/v1/tools/ducats> — the price table, carrying
  `wa_price`, warframe.market's own weighted average
- <https://api.warframe.market/v2/items> — the item list, used only to map their
  internal id to `gameRef`, which is Digital Extremes' own path for the item

**Whose numbers these are.** The prices are warframe.market's, computed from
trades their users post. The *items* are Digital Extremes' and are covered by the
same Content Policy as everything else here. We compute no price of our own and
publish no order, no username and no listing — only the aggregate figure they
already publish, per part.

**Their rules, and what we do about them.** Their
[published API rules](https://docs.warframe.market/docs/rules/overview/) state a
limit of **3 requests per second**, require *"a dedicated and descriptive
`User-Agent`"* with a contact, warn that clients disguising themselves as
browsers may be blocked, and ask callers to *"use caching, reuse responses, avoid
tight polling loops, and prefer incremental updates or WebSocket subscriptions
when appropriate"*. Warframe Prime Hunter sends a descriptive User-Agent naming
this repository, and asks **twice a day at most** — the figure read is
`previous_day`, a daily aggregate, so polling faster could not produce a
different answer. Two requests a day against an allowance of 3 per second is
about **0.0008%** of what is offered.

**On the WebSocket clause, since it says "when appropriate".** It is not
appropriate here, and that is a decision rather than an oversight: a
subscription is for a client that wants changes as they happen, and this reads a
figure that is recomputed once a day. Holding a socket open to be told about a
number that moves daily would cost them more than the two requests does, not
less. Re-read 2026-09-09 to check the rules had not moved; they had not.

Neither endpoint sends a `Cache-Control`, `ETag`, `Expires` or any
`X-RateLimit-*` header — re-measured the same day — which makes this the one
source whose refresh interval this project chose rather than read; the reasoning
is recorded in `tools/sources.py` beside the constant. Nor is any cookie they
set ever sent back: the build keeps no cookie jar, so each request is anonymous
and carries no session.

**Licensing is unstated, and that is recorded rather than assumed.** Their
documentation sets out rules for *using the API* but makes no statement about
licensing or redistribution of the data, carrying only a
`Copyright © Warframe.market` footer. So no licence grant is claimed here. What
is republished is minimal and derived: one rounded number per Prime part, in a
dataset that is itself never committed and is rebuilt from source on every clone.
Anyone publishing an instance should satisfy themselves this fits their
circumstances, as with everything else in this file.

**Nothing here involves real money.** Platinum is tradeable between players and
these are player-to-player prices — a fact about the game economy, earned by
playing it. Warframe Prime Hunter reads nothing DE sell for money: no Prime
Access, no Prime Vault packs, no Regal Aya, no bought Platinum. The figure is
shown for information and used only to order rows the ranking has already
declared equal; it never affects what the tool recommends.

---

## What Warframe Prime Hunter does not redistribute

The generated dataset (`data/prime-data.js`) is deliberately **not committed**
to this repository. Every clone and every CI build downloads it fresh from the
sources above, so DE's data is never republished from here.
