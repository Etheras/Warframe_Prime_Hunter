#!/usr/bin/env python3
"""
Keeping item artwork local, so the app makes no request to anyone while in use.

Artwork is normally hotlinked from cdn.warframestat.us, which means the app is
not usable offline *and* the CDN sees your IP plus which items you looked at.
Neither sits well with a tool that otherwise keeps everything on your machine.
But ~14 MB is too much to force on someone who does not care, so the first
download is opt-in via `build_data.py --with-images`.

**After that it is sticky.** Once `assets/img/` exists the build keeps it in use
and up to date on every run, without needing the flag again. Forgetting it used
to silently repoint the whole site back at the CDN while the local copies sat
there unused, which is the worst of both worlds and easy not to notice.
`--no-images` opts out; `--refresh-images` re-checks files that already exist.

See PROJECT.md section 3.
"""

from __future__ import annotations

import os
import re
import urllib.request

from sources import DE_TEXTURES, IMG_CDN, ROOT, UA, log

import limits  # sibling module; sources put tools/ on the path above

IMG_DIR = os.path.join(ROOT, "assets", "img")

# `imageName` is third-party text - it comes from the items API - and it ends up
# in a path we open for writing. So it gets what `sources.cache_path` already
# gives every other remote-controlled name: an allowlist.
#
# A blocklist does not work here, and "reject `..`" is the version that looks
# like it does. Measured on Windows: os.path.join(IMG_DIR, r"C:\Windows\Temp\x")
# is C:\Windows\Temp\x - IMG_DIR discarded, not one dot involved - and
# os.path.join(IMG_DIR, "/Windows/x") keeps the drive and drops the directory.
SAFE_NAME = re.compile(r"[A-Za-z0-9._-]+\Z")


def local_name(src: str) -> str | None:
    """
    The local filename for an artwork URL, or None if we will not write it.

    Two shapes are accepted, because artwork comes from Digital Extremes first
    and from the WFCD CDN only when DE's texture manifest could not be read:

        https://content.warframe.com/PublicExport/Lotus/.../AshPrime.png!00_<hash>
        https://cdn.warframestat.us/img/AshPrime.png

    Both reduce to `AshPrime.png`, which is deliberate — the two sources agree on
    the basename, so a folder downloaded before this change keeps working and a
    `--with-images` build does not re-download everything.

    Three gates, because each catches something the others do not: the prefix
    check keeps us to hosts we chose, `basename` collapses both separators and
    any drive letter (ntpath splits on `\\` too), and the allowlist refuses
    whatever is left - spaces, colons, control characters, non-ASCII. The DE form
    needs the basename gate most: its path is full of separators, and the
    `!00_<hash>` suffix has to come off before anything is written.
    """
    if src.startswith(DE_TEXTURES):
        # `!` starts the content hash and is not part of any filename we keep.
        name = os.path.basename(src[len(DE_TEXTURES):].split("?")[0].split("!")[0])
    elif src.startswith(IMG_CDN):
        name = src[len(IMG_CDN):].split("?")[0]
    else:
        return None
    if not name or name in (".", ".."):
        return None
    if name != os.path.basename(name) or not SAFE_NAME.match(name):
        return None
    return name


def have_local_images() -> bool:
    """True if a previous run already pulled artwork down."""
    return os.path.isdir(IMG_DIR) and any(
        os.path.isfile(os.path.join(IMG_DIR, f)) for f in os.listdir(IMG_DIR)
    )


def _remote_size(url: str) -> int | None:
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            n = r.headers.get("Content-Length")
        return int(n) if n and n.isdigit() else None
    except Exception:                                    # noqa: BLE001
        return None


def cache_images(items: list, offline: bool, verify: bool = False) -> int:
    """
    Download item artwork into assets/img/, prune what is no longer used, and
    repoint every item at the local copy.

    Three kinds of drift, handled differently because they cost differently:

      new Primes      a new item means a new filename, so it is simply missing
                      and gets fetched. Free to detect, always done.
      removed items   dropping the non-relic categories orphaned 110 files and
                      5.7 MB that nothing referenced. Free to detect, always
                      pruned.
      changed artwork same filename, different picture. Detecting this needs a
                      HEAD per file - about a minute for the full set, which is
                      as long as the rest of the build - and DE almost never
                      repaints an existing item. So it is behind
                      --refresh-images rather than run every time.
    """
    urls, refused = {}, []
    for it in items:
        src = it.get("image") or ""
        if not src.startswith((DE_TEXTURES, IMG_CDN)):
            continue
        name = local_name(src)
        if name is None:
            # Say so rather than skipping quietly: a name this shape means a
            # source is serving something it never has before, and that is
            # worth seeing in the build output.
            refused.append(src.rsplit("/", 1)[-1][:80])
            continue
        urls[src] = name
    if refused:
        log(f"  images: refused {len(refused)} unsafe filename(s): "
            + ", ".join(sorted(refused)[:3]))
    if not urls:
        return 0

    os.makedirs(IMG_DIR, exist_ok=True)
    fetched = replaced = failed = skipped = oversize = 0

    # Two ceilings rather than one, because 167 responses of 2 MB each is the
    # failure a per-image cap alone waves through. `budget` is what this run may
    # still download in total; images already on disk are skipped before they
    # reach it, so a routine build spends almost none of it and only a full
    # cold fetch approaches the limit. tools/limits.py has both numbers and what
    # they were measured against.
    budget = limits.MAX_IMAGE_TOTAL

    real_dir = os.path.realpath(IMG_DIR)
    for url, fname in sorted(urls.items()):
        dest = os.path.join(IMG_DIR, fname)

        # Belt to local_name's braces. It is redundant today and that is the
        # point: if the derivation above is ever loosened, or a symlink appears
        # in assets/img/, this is the line that still refuses to write outside
        # the folder. The whole defect was one derivation nobody re-checked.
        try:
            inside = os.path.commonpath([os.path.realpath(dest), real_dir]) == real_dir
        except ValueError:                                # different drive
            inside = False
        if not inside:
            log(f"  image refused, outside assets/img: {fname[:80]}")
            continue

        on_disk = os.path.exists(dest) and os.path.getsize(dest) > 0

        if on_disk and not verify:
            continue
        if on_disk and verify:
            if offline:
                continue
            remote = _remote_size(url)
            if remote is None or remote == os.path.getsize(dest):
                continue                                  # unchanged, or unknowable
        if offline:
            skipped += 1
            continue

        if budget <= 0:
            oversize += 1
            continue

        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                # Whichever bites first: this image's own ceiling, or what is
                # left of the run's. Nothing is written until the whole body has
                # been read inside the limit, so an oversized response costs
                # bandwidth and never disk.
                blob = limits.read_capped(
                    r, min(limits.MAX_IMAGE_BYTES, budget), fname)
            if not blob:
                raise ValueError("empty response")
            with open(dest, "wb") as fh:
                fh.write(blob)
            budget -= len(blob)
            if on_disk:
                replaced += 1
            else:
                fetched += 1
        except limits.TooLarge as e:
            # A partial run is already the designed behaviour here - the
            # rewiring pass below only repoints what actually landed, so the
            # site keeps the remote URL for this one rather than a broken image.
            oversize += 1
            log(f"  image refused: {fname} ({e})")
        except Exception as e:                            # noqa: BLE001
            failed += 1
            log(f"  image failed: {fname} ({e})")

    # anything the catalogue no longer references is dead weight
    wanted = set(urls.values())
    pruned = pruned_bytes = 0
    for f in os.listdir(IMG_DIR):
        path = os.path.join(IMG_DIR, f)
        if os.path.isfile(path) and f not in wanted:
            pruned_bytes += os.path.getsize(path)
            os.remove(path)
            pruned += 1

    # repoint only what actually landed, so a partial run still produces a
    # working site rather than a page of broken images
    rewired = 0
    for it in items:
        fname = local_name(it.get("image") or "")
        if fname is None:
            continue
        if os.path.exists(os.path.join(IMG_DIR, fname)):
            it["image"] = "assets/img/" + fname
            rewired += 1

    size = sum(os.path.getsize(os.path.join(IMG_DIR, f))
               for f in os.listdir(IMG_DIR)
               if os.path.isfile(os.path.join(IMG_DIR, f)))
    bits = [f"{len(wanted)} files ({size / 1024 / 1024:.1f} MB)",
            f"{rewired} items local"]
    if fetched:
        bits.append(f"{fetched} new")
    if replaced:
        bits.append(f"{replaced} updated")
    if pruned:
        bits.append(f"{pruned} pruned ({pruned_bytes / 1024 / 1024:.1f} MB)")
    if failed:
        bits.append(f"{failed} failed")
    if oversize:
        bits.append(f"{oversize} over the size ceiling")
    if skipped:
        bits.append(f"{skipped} missing, offline")
    log("images: " + ", ".join(bits))
    return rewired
