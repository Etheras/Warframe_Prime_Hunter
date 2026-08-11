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
import urllib.request

from sources import IMG_CDN, ROOT, UA, log

IMG_DIR = os.path.join(ROOT, "assets", "img")


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
    urls = {}
    for it in items:
        src = it.get("image") or ""
        if src.startswith(IMG_CDN):
            urls[src] = src[len(IMG_CDN):].split("?")[0]
    if not urls:
        return 0

    os.makedirs(IMG_DIR, exist_ok=True)
    fetched = replaced = failed = skipped = 0

    for url, fname in sorted(urls.items()):
        dest = os.path.join(IMG_DIR, fname)
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

        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                blob = r.read()
            if not blob:
                raise ValueError("empty response")
            with open(dest, "wb") as fh:
                fh.write(blob)
            if on_disk:
                replaced += 1
            else:
                fetched += 1
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
        src = it.get("image") or ""
        if not src.startswith(IMG_CDN):
            continue
        fname = src[len(IMG_CDN):].split("?")[0]
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
    if skipped:
        bits.append(f"{skipped} missing, offline")
    log("images: " + ", ".join(bits))
    return rewired
