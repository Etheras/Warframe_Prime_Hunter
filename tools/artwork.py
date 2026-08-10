#!/usr/bin/env python3
"""
Pulling item artwork local, so the app makes no request to anyone while in use.

Opt-in via build_data.py --with-images. See PROJECT.md section 3.
"""

from __future__ import annotations

import os
import urllib.request

from sources import IMG_CDN, ROOT, UA, log

# --------------------------------------------------------------------------
# 2. drop tables -> relic contents and relic sources
# --------------------------------------------------------------------------

IMG_DIR = os.path.join(ROOT, "assets", "img")


def cache_images(items: list, offline: bool) -> int:
    """
    Download item artwork into assets/img/ and repoint every item at the local
    copy.

    Artwork is normally hotlinked from cdn.warframestat.us, which means the app
    is not usable offline *and* the CDN sees your IP plus which items you looked
    at. Neither is acceptable for a tool that otherwise keeps everything local,
    but ~17 MB is too much to force on someone who does not care, so this is
    opt-in behind --with-images.

    Files already present are left alone, so re-running is cheap: only genuinely
    new Primes are fetched. The directory is gitignored for the same reason the
    dataset is - it is Digital Extremes' artwork, not ours to redistribute.
    """
    urls = {}
    for it in items:
        src = it.get("image") or ""
        if src.startswith(IMG_CDN):
            urls[src] = src[len(IMG_CDN):].split("?")[0]
    if not urls:
        return 0

    os.makedirs(IMG_DIR, exist_ok=True)
    have = miss = failed = 0
    for url, fname in sorted(urls.items()):
        dest = os.path.join(IMG_DIR, fname)
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            have += 1
            continue
        if offline:
            miss += 1
            continue
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                blob = r.read()
            if not blob:
                raise ValueError("empty response")
            with open(dest, "wb") as fh:
                fh.write(blob)
            miss += 1
        except Exception as e:                       # noqa: BLE001
            failed += 1
            log(f"  image failed: {fname} ({e})")

    # repoint only what actually landed, so a partial run still produces a
    # working site rather than a page of broken images
    rewired = 0
    for it in items:
        src = it.get("image") or ""
        if not src.startswith(IMG_CDN):
            continue
        fname = src[len(IMG_CDN):].split("?")[0]
        if os.path.exists(os.path.join(IMG_DIR, fname)):
            it["image"] = "assets/img/" + fname
            rewired += 1

    # items can share an image file, so these two counts differ legitimately
    size = sum(os.path.getsize(os.path.join(IMG_DIR, f))
               for f in os.listdir(IMG_DIR)
               if os.path.isfile(os.path.join(IMG_DIR, f)))
    log(f"images: {len(urls)} files ({size / 1024 / 1024:.1f} MB), "
        f"{rewired} items now local"
        + (f", {failed} failed" if failed else "")
        + (", offline so nothing fetched" if offline and miss else ""))
    return rewired


