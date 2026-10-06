#!/usr/bin/env python3
# Copyright 2026 bittuhere (anurag670singh@gmail.com)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Download every Store app logo into public/app-logos/ and point the catalog at
the local copy.

Why: the catalog used to hot-link favicons from other origins
(google.com/s2/favicons, raw.githubusercontent.com, the sites themselves), so
opening the Store meant hundreds of cross-origin requests that were slow, could
be blocked, and were a privacy leak. One local file per app id removes all
three problems.

Usage
-----
    python3 scripts/fetch_app_logos.py            # fetch what is missing
    python3 scripts/fetch_app_logos.py --force    # refetch everything
    python3 scripts/fetch_app_logos.py --prune    # also delete orphan files

The script is idempotent: an id that already has a file is skipped, so it can
be run after adding a few apps without touching the other 200.
"""

from __future__ import annotations

import argparse
import concurrent.futures as futures
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOGS = [ROOT / "public" / "storeCatalog.json"]
OUT = ROOT / "public" / "app-logos"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) webos-asset-fetcher/1.0"
TIMEOUT = 20

# The extension is decided by what the server actually sends, so nothing is
# renamed into a lie. Every one of these can be rendered by <img>.
MIME_EXT = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "image/x-icon": ".ico",
    "image/vnd.microsoft.icon": ".ico",
    "image/avif": ".avif",
    "image/bmp": ".bmp",
}
EXT_HINT = re.compile(r"\.(png|jpe?g|gif|webp|svgz?|ico|avif|bmp)(?:[?#]|$)", re.I)
REMOTE = re.compile(r"^https?://", re.I)


def slug(app_id: str) -> str:
    """An id becomes a file name: safe, lowercase, unique."""
    s = re.sub(r"[^a-z0-9._-]+", "-", str(app_id or "").strip().lower())
    return s.strip("-") or "app"


def sniff(data: bytes) -> str | None:
    """Identify an image from its first bytes — the last word on the format."""
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    if data[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return ".gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    if data[:4] == b"\x00\x00\x01\x00":
        return ".ico"
    if data[:2] == b"BM":
        return ".bmp"
    head = data[:512].lstrip()
    if head[:5].lower() == b"<?xml" or head[:4].lower() == b"<svg":
        return ".svg"
    return None


def fetch(url: str) -> tuple[bytes, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "image/*,*/*;q=0.8"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
        body = res.read(3 * 1024 * 1024)  # no logo is bigger than 3 MB
        ctype = (res.headers.get("Content-Type") or "").split(";")[0].strip().lower()
    return body, ctype


def asset_for(entry: dict) -> str | None:
    """The best icon URL the catalog offers."""
    for key in ("icon", "logo", "art"):
        v = entry.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    data = entry.get("data") or {}
    for key in ("icon", "logo", "art"):
        v = data.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None


def local_for(entry: dict) -> str | None:
    for key in ("icon", "logo", "art"):
        v = entry.get(key)
        if isinstance(v, str) and v.startswith("app-logos/"):
            return v
    return None


def store(name: str, body: bytes, ctype: str, url: str) -> str:
    ext = sniff(body)
    if not ext:
        ext = MIME_EXT.get(ctype)
    if not ext:
        m = EXT_HINT.search(urllib.parse.urlparse(url).path)
        ext = ("." + m.group(1).lower()) if m else ".png"
    if ext == ".svgz":
        ext = ".svg"
    path = OUT / f"{name}{ext}"
    path.write_bytes(body)
    # any older copy under a different extension is now a lie
    for other in OUT.glob(f"{name}.*"):
        if other != path:
            other.unlink(missing_ok=True)
    return f"app-logos/{path.name}"


def logo_for(entry: dict) -> tuple[dict, str]:
    """Resolve one entry to a local path. Raises with a readable reason."""
    src = asset_for(entry)
    if not src:
        raise ValueError("no icon field")
    if src.startswith("app-logos/"):
        return entry, src
    if not REMOTE.match(src):
        return entry, src  # already a project-relative asset (img/…)
    body, ctype = fetch(src)
    if len(body) < 24:
        raise ValueError(f"too small ({len(body)} bytes)")
    path = store(slug(entry.get("id") or entry.get("name")), body, ctype, src)
    return entry, path


def main() -> int:
    ap = argparse.ArgumentParser(description="Localize the Store's app logos.")
    ap.add_argument("--force", action="store_true", help="refetch icons that already exist")
    ap.add_argument("--prune", action="store_true", help="delete files no catalog entry uses")
    ap.add_argument("--jobs", type=int, default=16, help="parallel downloads (default 16)")
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    used: set[str] = set()
    ok = skipped = failed = 0
    failures: list[tuple[str, str, str]] = []

    for cat in CATALOGS:
        entries = json.loads(cat.read_text(encoding="utf8"))
        work = []
        for e in entries:
            local = local_for(e)
            if local and (OUT / Path(local).name).exists() and not args.force:
                used.add(Path(local).name)
                skipped += 1
                continue
            work.append(e)

        if work:
            with futures.ThreadPoolExecutor(max_workers=args.jobs) as pool:
                jobs = {pool.submit(logo_for, e): e for e in work}
                for job in futures.as_completed(jobs):
                    e = jobs[job]
                    name = e.get("id") or e.get("name") or "?"
                    try:
                        entry, path = job.result()
                    except (urllib.error.URLError, urllib.error.HTTPError, OSError, ValueError,
                            TimeoutError, UnicodeDecodeError) as err:
                        failed += 1
                        failures.append((str(name), asset_for(e) or "-", str(err)[:110]))
                        continue
                    if path.startswith("app-logos/"):
                        entry["icon"] = path
                        used.add(Path(path).name)
                        ok += 1

        cat.write_text(json.dumps(entries, indent=1, ensure_ascii=False) + "\n", encoding="utf8")

    if args.prune:
        for f in OUT.iterdir():
            if f.is_file() and f.name not in used:
                f.unlink()
                print(f"  pruned {f.name}")

    print(f"\n{ok} downloaded · {skipped} already local · {failed} failed · {len(used)} files in use")
    if failures:
        print("\nCould not fetch (the catalog keeps its original URL for these):")
        for name, url, err in failures[:25]:
            print(f"  {name:<22} {err}\n      {url[:96]}")
        if len(failures) > 25:
            print(f"  … and {len(failures) - 25} more")
    return 0


if __name__ == "__main__":
    sys.exit(main())
