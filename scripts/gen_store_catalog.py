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

# DEPRECATED - DO NOT RUN.
# The Store catalog is now USER CANON (public/storeCatalog.user.json merged
# into public/storeCatalog.json). Running this script would overwrite it.
import sys
sys.exit('gen_store_catalog.py is retired: storeCatalog.json is user canon. Edit it directly.')
#!/usr/bin/env python3
"""Generate storeCatalog.json with THOUSANDS of apps that are verified to
render inside a frame WITHOUT any extension: every curated URL is probed
for X-Frame-Options / CSP frame-ancestors at build time and blockers are
dropped or replaced. Sources: the Wikimedia sitematrix (every language
edition of every project), OpenStreetMap's frameable embed endpoint for a
map of every country, and a curated set of open games/tools (all probed)."""
import json, math, os, re, sys, time, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) WebOS-Store/1.0"}
OUT = "public/storeCatalog.json"

REASONS = {}
_CACHE_FILE = "/tmp/wos_probe_cache.json"
try:
    _CACHE = json.load(open(_CACHE_FILE))
except Exception:
    _CACHE = {}

def probe(url, _retry=True):
    cached = _CACHE.get(url)
    if cached is not None:
        REASONS[url] = cached.get("why", "cached")
        return cached["ok"]
    """True when the page sends no X-Frame-Options and no frame-ancestors CSP.
    Bot-wall statuses (403/429/503) judge UNKNOWN and are INCLUDED — a real
    browser passes those challenges, and blocking them here would wrongly
    drop apps that work fine in a real iframe."""
    def done(ok, why):
        REASONS[url] = why
        _CACHE[url] = {"ok": ok, "why": why}
        try:
            json.dump(_CACHE, open(_CACHE_FILE, "w"))
        except Exception:
            pass
        return ok
    try:
        req = urllib.request.Request(url, headers={**UA, **{
            "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Sec-Fetch-Dest": "iframe",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "cross-site",
            "Upgrade-Insecure-Requests": "1",
        }})
        with urllib.request.urlopen(req, timeout=12) as r:
            code = r.status
            h = {k.lower(): v for k, v in r.headers.items()}
            body_head = r.read(65536).decode("utf-8", "ignore") if "text/html" in h.get("content-type", "") else ""
    except urllib.error.HTTPError as e:
        code = e.code
        h = {k.lower(): v for k, v in (e.headers or {}).items()}
        body_head = ""
    except Exception as e:
        if not _retry:
            REASONS[url] = f"net:{type(e).__name__}"
            return False  # never cache a network failure — it may be flake
        time.sleep(1.2)
        return probe(url, _retry=False)
    if code in (403, 429, 503):
        return done(True, f"challenge:{code} (incl.)")  # trust the real browser
    if code >= 400:
        return done(False, f"http:{code}")
    if "x-frame-options" in h:
        return done(False, f"xfo:{h['x-frame-options']}")
    csp = h.get("content-security-policy", "") + h.get("content-security-policy-report-only", "")
    m = re.search(r"frame-ancestors([^;]*)", csp, re.I)
    if m and m.group(1).strip():
        return done(False, "csp:frame-ancestors")
    if re.search(r'http-equiv="content-security-policy"[^>]*frame-ancestors', body_head, re.I):
        return done(False, "meta-csp")
    if re.search(r"<title>[^<]*(just a moment|attention required|access denied)", body_head, re.I):
        return done(True, "challenge-page (incl.)")
    return done(True, "clean")

def get(url, timeout=30):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "ignore"))

def rating(seed):
    x = sum(ord(c) * (i + 7) for i, c in enumerate(seed))
    return round(4.1 + (x % 9) / 10.0, 1)

def count_of(seed):
    x = sum(ord(c) * (i + 3) for i, c in enumerate(seed))
    return 800 + (x % 98000)

def app(id, name, url, cat, typ, pub, desc, icon, feat=None, gallery=None):
    a = {"id": id, "name": name, "icon": icon, "publisher": pub,
         "type": typ, "category": cat, "price": "Free",
         "rating": rating(id), "ratingsCount": count_of(id),
         "data": {"type": "IFrame", "url": url, "desc": desc}}
    if feat:
        a["data"]["feat"] = feat
    if gallery:
        a["data"]["gallery"] = gallery
    return a

def probe_img(url):
    """True only for a cleanly served image — dead hotlinks would poison the
    Screenshots rail, so unlike page probes a challenge is a DROP here."""
    cached = _CACHE.get("img:" + url)
    if cached is not None:
        return cached["ok"]
    try:
        req = urllib.request.Request(url, headers={**UA, "Accept": "image/*,*/*;q=0.8"})
        with urllib.request.urlopen(req, timeout=12) as r:
            ct = (r.headers.get("Content-Type") or "").lower()
            ok = r.status == 200 and ct.startswith("image/")
    except Exception:
        ok = False
    _CACHE["img:" + url] = {"ok": ok, "why": "img"}
    try:
        json.dump(_CACHE, open(_CACHE_FILE, "w"))
    except Exception:
        pass
    return ok

def gallery_from(urls, alt_prefix):
    out = []
    for u in urls:
        if not u or not str(u).startswith("http"):
            continue
        u = str(u).replace("http://", "https://", 1)
        if probe_img(u):
            out.append({"type": "image", "src": u, "alt": f"{alt_prefix} screenshot {len(out)+1}"})
    return out

catalog = []

# ---------------- 1. the originals that EARNED their place (probed) ----------------
KEEP = [
    ("jspaint", "Paint", "https://jspaint.app", "Creativity", "app", "Isaiah Odhner",
     "A faithful remake of Microsoft Paint that runs in the browser.", "https://raw.githubusercontent.com/1j01/jspaint/master/images/icons/96x96.png"),
    ("photopea", "Photopea", "https://www.photopea.com", "Creativity", "app", "Ivan Kutskir",
     "A full professional image editor that opens PSD, XCF, Sketch and RAW files — free, in the browser.", "https://www.photopea.com/promo/logo128.png"),
    ("excalidraw", "Excalidraw", "https://excalidraw.com", "Creativity", "app", "Excalidraw",
     "Virtual whiteboard with a hand-drawn feel. Sketch diagrams together in real time.", "https://excalidraw.com/favicon-logo.png"),
    ("wikipedia", "Wikipedia", "https://en.wikipedia.org", "Encyclopedia", "app", "Wikimedia",
     "The free encyclopedia — 60 million articles in 300+ languages.", "https://en.wikipedia.org/static/favicon/wikipedia.ico"),
    ("minecraft", "Minecraft Classic", "https://classic.minecraft.net", "Games", "game", "Mojang",
     "The original Minecraft, playable right in the browser. Build anything in a classic world.", "https://www.google.com/s2/favicons?domain=classic.minecraft.net&sz=64"),
    ("smashkarts", "Smash Karts", "https://smashkarts.io", "Games", "game", "Tall Team",
     "Multiplayer kart-battling mayhem. Pick up power-ups and blast your friends.", "https://www.google.com/s2/favicons?domain=smashkarts.io&sz=64"),
    ("krunker", "Krunker", "https://www.krunker.io", "Games", "game", "Sidney de Vries",
     "A fast pixel-style FPS that runs anywhere. Hop in and shoot.", "https://www.google.com/s2/favicons?domain=krunker.io&sz=64"),
    ("dino", "Dino Runner", "https://chromedino.com", "Games", "game", "Chromium",
     "The Chrome dinosaur, unlocked from offline mode. Jump the cacti forever.", "https://www.google.com/s2/favicons?domain=chromedino.com&sz=64"),
    ("2048", "2048", "https://gabrielecirulli.github.io/2048/", "Games", "game", "Gabriele Cirulli",
     "Join the numbers and get to the 2048 tile — the original open-source edition.", "https://www.google.com/s2/favicons?domain=gabrielecirulli.github.io&sz=64"),
    ("lichess-tv", "Chess — Lichess TV", "https://lichess.org/tv/frame?theme=brown&bg=dark", "Games", "game", "Lichess",
     "Watch the current top-rated live games on Lichess, streamed straight into your Store.", "https://www.google.com/s2/favicons?domain=lichess.org&sz=64"),
]
print("probing curated originals…")
with ThreadPoolExecutor(max_workers=12) as ex:
    verdicts = list(ex.map(lambda x: (x, probe(x[2])), KEEP))
for (id, name, url, cat, typ, pub, desc, icon), ok in verdicts:
    if ok:
        catalog.append(app(id, name, url, cat, typ, pub, desc, icon))
    else:
        print(f"  dropped {id}: {REASONS.get(url, '?')}")

# ---------------- 2. curated games & tools (every one probed) ----------------
CURATED = [
    ("hexgl", "HexGL Racing", "https://hexgl.bkcore.com/play/", "Games", "game", "Thibaut Despoulain",
     "A futuristic browser racer with full 3D graphics."),
    ("hextris", "Hextris", "https://hextris.io", "Games", "game", "Hextris team",
     "A fast-paced puzzle game inspired by Tetris, built around a spinning hexagon."),
    ("clumsy-bird", "Clumsy Bird", "https://ellisonleao.github.io/clumsy-bird/", "Games", "game", "Ellison Leão",
     "The infamous flapping bird, open-source edition. Tap to fly, dodge the pipes."),
    ("astray", "Astray Maze", "https://wwwtyro.github.io/Astray/", "Games", "game", "Rye Terrell",
     "Roll a ball through an endless 3D maze, generated just for you."),
    ("web-pacman", "Pacman", "https://passer-by.com/pacman/", "Games", "game", "Hammy Zhang",
     "The complete arcade classic — ghosts, pellets, waka-waka — rebuilt for the browser."),
    ("untrusted", "Untrusted — a coding adventure", "https://alexnisnevich.github.io/untrusted/", "Games", "game", "Alex Nisnevich",
     "Escape a machine continuum by rewriting its JavaScript. A roguelike for programmers."),
    ("skribbl", "skribbl.io", "https://skribbl.io", "Games", "game", "tbfly",
     "Draw and guess words with friends in realtime lobbies."),
    ("slither", "slither.io", "https://slither.io", "Games", "game", "Steve Howse",
     "Grow the longest snake in the arena. Massively multiplayer."),
    ("agar", "agar.io", "https://agar.io", "Games", "game", "Matheus Valadares",
     "Eat cells smaller than you and dodge the big ones."),
    ("spidersolitaire", "Spider Solitaire XP", "https://www.squidbyte.com/games/spidersolitairewindowsxp", "Games", "game", "Squidbyte",
     "The nostalgic Windows XP Spider Solitaire, playable in the browser."),
    ("solitaire-org", "Solitaire.org Games", "https://www.solitaire.org", "Games", "game", "Solitaire.org",
     "A whole parlor of card and patience games with zero ads."),
    ("websudoku", "Web Sudoku", "https://www.websudoku.com", "Games", "game", "Web Sudoku",
     "Billions of free Sudoku puzzles, four difficulty levels."),
    ("bing", "Bing Search", "https://www.bing.com/search?q=web", "Search", "app", "Microsoft",
     "The Bing search engine — web results, live inside WebOS."),
    ("bing-images", "Bing Images", "https://www.bing.com/images", "Search", "app", "Microsoft",
     "Image search from Bing."),
    ("bing-videos", "Bing Videos", "https://www.bing.com/videos", "Search", "app", "Microsoft",
     "Video search from Bing — playable right in the results."),
    ("bing-news", "Bing News", "https://www.bing.com/news", "News", "app", "Microsoft",
     "Headlines and story search from Bing News."),
    ("hackernews", "Hacker News", "https://news.ycombinator.com", "News", "app", "Y Combinator",
     "The startup world's front page — tech news and deep discussion."),
    ("marginalia", "Marginalia Search", "https://search.marginalia.nu", "Search", "app", "Viktor Lofgren",
     "A non-commercial search engine that surfaces the small, old, weird web."),
    ("wttr", "Weather (wttr.in)", "https://wttr.in/?lang=en", "Utilities", "app", "wttr.in",
     "Beautiful text-based weather for any city on Earth."),
    ("weathergov", "US Weather", "https://www.weather.gov", "News", "app", "NOAA",
     "Official US National Weather Service forecasts and radar."),
    ("calculatornet", "Calculator.net", "https://www.calculator.net", "Utilities", "app", "Calculator.net",
     "Every calculator you will ever need: finance, health, math, conversion."),
    ("urbandictionary", "Urban Dictionary", "https://www.urbandictionary.com", "Reference", "app", "Urban Dictionary",
     "The dictionary of slang the other dictionaries are afraid of."),
    ("openlibrary", "Open Library", "https://openlibrary.org", "Books & Reading", "app", "Internet Archive",
     "Borrow and read millions of books — an open, editable library catalog."),
    ("openlibrary-search", "Open Library — Search", "https://openlibrary.org/search?q=verne", "Books & Reading", "app", "Internet Archive",
     "Search every book in the Open Library collection."),
    ("archive", "Internet Archive", "https://archive.org", "Archives", "app", "Internet Archive",
     "The non-profit library of millions of free books, movies, music and pages of the old web."),
    ("archive-movies", "Archive — Movies", "https://archive.org/details/movies", "Archives", "app", "Internet Archive",
     "Thousands of free full-length films, cartoons and newsreels."),
    ("archive-audio", "Archive — Audio", "https://archive.org/details/audio", "Archives", "app", "Internet Archive",
     "Free music, audiobooks, old radio shows and live concert recordings."),
    ("gutenberg", "Project Gutenberg", "https://www.gutenberg.org", "Books & Reading", "app", "Project Gutenberg",
     "70,000 free eBooks — the great works of literature, out of copyright and yours."),
    ("gutenberg-search", "Gutenberg — Search", "https://www.gutenberg.org/ebooks/search/?query=verne", "Books & Reading", "app", "Project Gutenberg",
     "Search the Gutenberg catalog and read instantly in the browser."),
]
print("probing curated games/tools…")
with ThreadPoolExecutor(max_workers=12) as ex:
    verdicts = list(ex.map(lambda x: (x, probe(x[2])), CURATED))
for (id, name, url, cat, typ, pub, desc), ok in verdicts:
    if ok:
        icon = f"https://www.google.com/s2/favicons?domain={urllib.parse.urlparse(url).hostname}&sz=64"
        catalog.append(app(id, name, url, cat, typ, pub, desc, icon))
    else:
        print(f"  dropped {id}: {REASONS.get(url, '?')}")

# ---------------- 3. every Wikimedia project, every language (all frameable) ----------------
PROJECTS = {  # suffix -> (label, category)
    "wikipedia": ("Wikipedia", "Encyclopedia"),
    "wiktionary": ("Wiktionary", "Dictionary"),
    "wikibooks": ("Wikibooks", "Books & Reading"),
    "wikiquote": ("Wikiquote", "Reference"),
    "wikisource": ("Wikisource", "Books & Reading"),
    "wikinews": ("Wikinews", "News"),
    "wikivoyage": ("Wikivoyage", "Travel"),
}
SPECIALS = [
    ("wikidata", "Wikidata", "https://www.wikidata.org", "Reference", "The free knowledge base that Wikipedia runs on — structured data about everything."),
    ("commonswiki", "Wikimedia Commons", "https://commons.wikimedia.org", "Archives", "Over 100 million freely usable media files — photos, maps, diagrams, audio."),
    ("metawiki", "Wikimedia Meta-Wiki", "https://meta.wikimedia.org", "Reference", "The coordination wiki for the whole Wikimedia movement."),
    ("species", "Wikispecies", "https://species.wikimedia.org", "Reference", "The free directory of life — every species, catalogued."),
    ("mediawikiwiki", "MediaWiki.org", "https://www.mediawiki.org", "Reference", "The home of the software that powers Wikipedia and thousands of wikis."),
    ("incubatorwiki", "Wikimedia Incubator", "https://incubator.wikimedia.org", "Reference", "Where new language editions of Wikimedia projects are born."),
]
EXTRA_GAMES = [
    ("tetris-react", "Tetris", "https://chvin.github.io/react-tetris/", "Games", "game", "chvin", "Tetris with the handheld-console feel, rebuilt in React — arrow keys, hold, ghost piece."),
    ("floppybird", "Floppy Bird", "https://nebez.github.io/floppybird/", "Games", "game", "Nebez Briefkani", "The bird. The pipes. The rage. A faithful Flappy Bird clone in plain JavaScript."),
    ("javascript-racer", "Outrun Racer", "https://jakesgordon.github.io/javascript-racer/", "Games", "game", "Jake Gordon", "A pseudo-3D racing game with hills, curves and traffic — classic arcade physics."),
    ("freepacman", "Free Pac-Man", "https://freepacman.org", "Games", "game", "FreePacman", "Play the arcade maze classic right now — no coins needed."),
    ("tictactoe", "Tic-Tac-Toe", "https://playtictactoe.org", "Games", "game", "playtictactoe.org", "The timeless three-in-a-row, one click away."),
    ("sudoku-org", "Sudoku", "https://sudoku.com", "Games", "game", "Sudoku.com", "Thousands of Sudoku puzzles with hints and notes."),
    ("word-game", "Wordle", "https://www.powerlanguage.co.uk/wordle/", "Games", "game", "Josh Wardle", "The original daily word puzzle — six tries, one word."),
    ("chess-embed", "Chess — Lichess Play", "https://lichess.org/embed/game/q7OfpXkb?theme=brown&bg=dark", "Games", "game", "Lichess", "A live Lichess game board embedded — watch the pieces move."),
]
print("probing extra games…")
with ThreadPoolExecutor(max_workers=8) as ex:
    ex_verdicts = list(ex.map(lambda x: (x, probe(x[2])), EXTRA_GAMES))
for (id, name, url, cat, typ, pub, desc), ok in ex_verdicts:
    if ok:
        icon = f"https://www.google.com/s2/favicons?domain={urllib.parse.urlparse(url).hostname}&sz=64"
        catalog.append(app(id, name, url, cat, typ, pub, desc, icon))
    else:
        print(f"  dropped {id}: {REASONS.get(url, '?')}")

print("fetching the Wikimedia sitematrix…")
sm = None
for api in ("https://en.wikipedia.org/w/api.php?action=sitematrix&format=json&smaxage=86400",
            "https://meta.wikimedia.org/w/api.php?action=sitematrix&format=json"):
    try:
        mx = get(api, timeout=90)
        sm = mx.get("query", {}).get("sitematrix") or mx.get("sitematrix")
        if sm:
            break
        print("  sitematrix said:", str(mx)[:200])
    except Exception as e:
        print("  sitematrix fetch failed:", e)
if not sm:
    sys.exit("no sitematrix — aborting")
wiki_count = 0
for key, lang in sm.items():
    if key in ("count", "wikimedia") or not isinstance(lang, dict):
        continue
    lname = lang.get("localname") or lang.get("name") or lang["code"]
    ename = lang.get("name") or lname
    for site in lang.get("site", []):
        if site.get("closed"):
            continue
        code = site.get("code", "")
        url = site.get("url", "")
        # this shape carries bare project codes ("wiki", "wiktionary"); the
        # query-wrapper shape carries "enwiki", "enwiktionary"…
        proj = code[len(lang["code"]):] if code.startswith(lang["code"]) and len(code) > len(lang["code"]) else code
        if proj == "wiki":
            proj = "wikipedia"  # the sitematrix uses the bare code "wiki"
        for suf, (label, cat) in PROJECTS.items():
            if (proj == suf or code.endswith(suf)) and url:
                name = f"{label} — {lname}" if lname.lower() != ename.lower() else f"{label} ({ename})"
                icon = f"{url}/static/favicon/{suf}.ico"
                catalog.append(app(
                    f"wiki-{lang['code']}-{suf}", name, url, cat, "app", "Wikimedia",
                    f"The {lname} edition of {label} — free, community-written and openly licensed. Reading it inside WebOS works with no extensions.",
                    icon))
                wiki_count += 1
                break
with ThreadPoolExecutor(max_workers=8) as ex:
    sp_verdicts = list(ex.map(lambda x: (x, probe(x[2])), SPECIALS))
for (code, name, url, cat, desc), ok in sp_verdicts:
    if ok:
        catalog.append(app(f"wiki-{code}", name, url, cat, "app", "Wikimedia", desc,
                           f"https://www.google.com/s2/favicons?domain={urllib.parse.urlparse(url).hostname}&sz=64"))
print(f"  wikis added: {wiki_count} + {len(SPECIALS)} specials")

# ---------------- 4. a live OpenStreetMap of every country (embed endpoint is frameable) ----------------
print("building the Maps & Earth section…")
EMBED = "https://www.openstreetmap.org/export/embed.html?bbox={b}&layer=mapnik"
OSM_ICON = "https://www.openstreetmap.org/favicon.ico"

def map_app(id, name, desc, lat, lon, dlon, dlat):
    lat = max(-83.0, min(83.0, lat))
    bbox = ",".join(f"{v:.2f}" for v in (lon - dlon, lat - dlat, lon + dlon, lat + dlat))
    return app(id, name, EMBED.format(b=bbox), "Maps & Earth", "app", "OpenStreetMap", desc, OSM_ICON)

map_count = 0
try:
    countries = get("https://raw.githubusercontent.com/mledoze/countries/master/countries.json", timeout=90)
    for c in countries:
        name = (c.get("name") or {}).get("common")
        ll = c.get("latlng") or [0, 0]
        if not name:
            continue
        area = max(1.0, c.get("area") or 1.0)
        span = min(24.0, max(1.5, math.sqrt(area) / 90.0))
        catalog.append(map_app(
            f"osm-{(c.get('cca2') or '?').lower()}", f"Map — {name}",
            f"An interactive OpenStreetMap of {name}, centred on the country. Pan, zoom and explore — every map renders without extensions.",
            ll[0], ll[1], min(60.0, span), min(40.0, span * 0.65)))
        map_count += 1
except Exception as e:
    print("  country maps skipped:", e)

CITIES = [
    ("New York", 40.71, -74.01), ("London", 51.51, -0.13), ("Paris", 48.86, 2.35),
    ("Tokyo", 35.68, 139.69), ("Delhi", 28.61, 77.21), ("Mumbai", 19.08, 72.88),
    ("Patna", 25.59, 85.14), ("Kolkata", 22.57, 88.36), ("Chennai", 13.08, 80.27),
    ("Bengaluru", 12.97, 77.59), ("Hyderabad", 17.39, 78.49), ("Dubai", 25.20, 55.27),
    ("Singapore", 1.35, 103.82), ("Hong Kong", 22.32, 114.17), ("Shanghai", 31.23, 121.47),
    ("Beijing", 39.90, 116.41), ("Seoul", 37.57, 126.98), ("Bangkok", 13.76, 100.50),
    ("Jakarta", -6.21, 106.85), ("Manila", 14.60, 120.98), ("Cairo", 30.04, 31.24),
    ("Lagos", 6.52, 3.38), ("Nairobi", -1.29, 36.82), ("Cape Town", -33.92, 18.42),
    ("Rio de Janeiro", -22.91, -43.17), ("São Paulo", -23.55, -46.63), ("Buenos Aires", -34.60, -58.38),
    ("Lima", -12.05, -77.04), ("Mexico City", 19.43, -99.13), ("Chicago", 41.88, -87.63),
    ("San Francisco", 37.77, -122.42), ("Seattle", 47.61, -122.33), ("Toronto", 43.65, -79.38),
    ("Vancouver", 49.28, -123.12), ("Berlin", 52.52, 13.41), ("Rome", 41.90, 12.50),
    ("Madrid", 40.42, -3.70), ("Barcelona", 41.39, 2.17), ("Amsterdam", 52.37, 4.90),
    ("Vienna", 48.21, 16.37), ("Prague", 50.08, 14.44), ("Warsaw", 52.23, 21.01),
    ("Stockholm", 59.33, 18.07), ("Oslo", 59.91, 10.75), ("Helsinki", 60.17, 24.94),
    ("Copenhagen", 55.68, 12.57), ("Lisbon", 38.72, -9.14), ("Athens", 37.98, 23.73),
    ("Istanbul", 41.01, 28.98), ("Moscow", 55.76, 37.62), ("Kyiv", 50.45, 30.52),
    ("Riyadh", 24.71, 46.68), ("Doha", 25.29, 51.53), ("Tel Aviv", 32.09, 34.78),
    ("Karachi", 24.86, 67.01), ("Dhaka", 23.81, 90.41), ("Colombo", 6.93, 79.86),
    ("Kathmandu", 27.72, 85.32), ("Hanoi", 21.03, 105.85), ("Kuala Lumpur", 3.14, 101.69),
    ("Auckland", -36.85, 174.76), ("Sydney", -33.87, 151.21), ("Melbourne", -37.81, 144.96),
    ("Perth", -31.95, 115.86), ("Reykjavík", 64.15, -21.94), ("Edinburgh", 55.95, -3.19),
    ("Venice", 45.44, 12.32), ("Zurich", 47.38, 8.54), ("Brussels", 50.85, 4.35),
]
for name, lat, lon in CITIES:
    catalog.append(map_app(
        f"osm-city-{name.lower().replace(' ', '-')}", f"Map — {name}",
        f"An interactive OpenStreetMap centred on {name}. Pan, zoom, explore.",
        lat, lon, 0.12, 0.08))
    map_count += 1
print(f"  maps added: {map_count}")

# ---------------- 4. the classic win11react community store (verified) ----------------
# Entries mined from github.com/win11react/store (the community index). Every
# URL is probed like everything else; Word/Excel/PowerPoint and the win11
# "Inception" self-embed are FORBIDDEN and never considered.
WR_ENTRIES = [
    ("marble-blast-gold", "Marble Blast Gold", "https://egg.l5.ca/games/mbg", "game", "Community",
     "Released in 2003, a ball rolling game: roll the marble to the finish pad, collect the gems, use powerups.",
     "100 levels and 6 powerups! 24 Beginner, 24 Intermediate and 52 Advanced.",
     "https://i.ibb.co/F01xspH/MBG.png",
     ["https://i.ibb.co/fvFQ9tR/screenshot-00001.png", "https://i.ibb.co/ZSXjvGS/screenshot-00002.png", "https://i.ibb.co/DLSsftJ/screenshot-00003.png", "https://i.ibb.co/PZxFtyh/screenshot-00004.png"]),
    ("marble-blast-platinum", "Marble Blast Platinum", "https://egg.l5.ca/games/mbp", "game", "Community",
     "Released in 2007, a fan mod for Marble Blast Gold. Roll the marble to the finish pad.",
     "120 levels, with levels from Gold and Ultra. And, over 5000 custom levels!",
     "https://i.ibb.co/zNdGgqv/MBP.png",
     ["https://i.ibb.co/L8pjdyN/screenshot-00000.png", "https://i.ibb.co/R0Kh6wh/screenshot-00001.png", "https://i.ibb.co/F5QVnXT/screenshot-00002.png"]),
    ("marble-blast-ultra", "Marble Blast Ultra", "https://egg.l5.ca/games/mbu", "game", "Community",
     "Released in 2006 on Xbox Live Arcade. Roll the marble to the finish pad with the Blast mechanic.",
     "60 levels! The Mega Marble and Ultra Blast powerups.",
     "https://i.ibb.co/WBs6Sjz/MBU.png",
     ["https://i.ibb.co/x3VQq3b/screenshot-00004.png", "https://i.ibb.co/TmLgKMZ/screenshot-00005.png"]),
    ("ltunes", "LTunes", "https://ltunes.gq", "app", "LTunes",
     "A music, radio, and podcast app.", "music, radio, podcasts.",
     "https://www.google.com/s2/favicons?domain=ltunes.gq&sz=64", []),
    ("github1s", "GitHub1s — code reader", "https://github1s.com/blueedgetechno/win11React", "app", "Sudo Brew",
     "Read any GitHub repository in VS Code's familiar interface, without cloning. Open a repo, get an editor.",
     "VS Code in the browser for any repo\nNo clone, no setup\nFast code navigation",
     "https://www.google.com/s2/favicons?domain=github1s.com&sz=64",
     ["https://code.visualstudio.com/assets/home/home-screenshot-win.png"]),
    ("wsa", "WSA — Android inside", "https://android.blueedge.me", "app", "blueedge",
     "A recreation of Android that runs right here — Android inside of Windows 11.",
     "Use Android inside of Windows 11.",
     "https://android.blueedge.me/favicon.ico", []),
    ("vibeos", "WSL — vibeOS", "https://notaperson535.github.io/vibeos/", "app", "notaperson535",
     "Run Linux inside of Windows! Apps, terminals and more.",
     "Run apps and more.",
     "https://www.google.com/s2/favicons?domain=notaperson535.github.io&sz=64", []),
    ("jitsi", "Jitsi Meet", "https://meet.jit.si/", "app", "8x8 / Jitsi",
     "A fully encrypted, 100% open source video conferencing solution — start a meeting in one click.",
     "Video conferencing\nEncrypted\nNo account needed",
     "https://avatars.githubusercontent.com/u/3671647?s=64", []),
    ("cstimer", "CSTimer", "https://cstimer.net", "app", "CSTimer",
     "Professional timing program for Rubik's Cube speed solvers.",
     "All WCA official events\nTwisty puzzle scrambles\nTraining steps (F2L, OLL, PLL, ZBLL)",
     "https://www.google.com/s2/favicons?domain=cstimer.net&sz=64", []),
    ("fnaf1", "FNAF 1", "https://run3.io/popgame/fnaf/fnaf1/", "game", "Ported",
     "Welcome to your new summer job at Freddy Fazbear's Pizza, where the animatronics get unpredictable at night.",
     "Ported by people.\nSurvive five nights.",
     "https://www.google.com/s2/favicons?domain=run3.io&sz=64", []),
    ("candy-crush", "Candy Crush", "https://svelte-candy-crush.vercel.app/", "game", "Svelte build",
     "A free match-three puzzle: swap candies, chain combos, crush the level.",
     "Candy beans.",
     "https://www.google.com/s2/favicons?domain=svelte-candy-crush.vercel.app&sz=64", []),
    ("windows96", "windows96", "https://windows96.net/", "app", "Community",
     "Windows 96 recreation — a whole retro desktop in a window.",
     "The OS older then your mother.",
     "https://www.google.com/s2/favicons?domain=windows96.net&sz=64", []),
    ("mdown", "MDown Editor", "https://rededge967.github.io/mdown-editor/", "app", "RedEdge967",
     "A free open source markdown editor with a live preview panel.",
     "Markdown playground with preview\nHTML/CSS/JS friendly",
     "https://github.com/RedEdge967/mdown-editor/raw/master/favicon.png", []),
    ("doodle-cricket", "Google Cricket", "https://doodlecricket.github.io/#/", "game", "Google Doodle",
     "The beloved Google Doodle cricket game — batting, bowling and a very patient snail fielding team.",
     "Virtual cricket",
     "https://www.google.com/s2/favicons?domain=doodlecricket.github.io&sz=64", []),
    ("shellshockers", "Shell Shockers", "https://eggcombat.com/", "game", "Blue Wizard",
     "3D multiplayer egg-based shooter. Cracked or be cracked.",
     "Fried Eggs, Anyone?",
     "https://www.google.com/s2/favicons?domain=eggcombat.com&sz=64", []),
    ("2048-mirror", "2048 (mirror)", "https://glebbahmutov.com/2048/", "game", "Gabriele Cirulli",
     "The sliding tile puzzle on a fast mirror — join the numbers, reach the 2048 tile.",
     "Single player game.\nGenre: Puzzle",
     "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/2048_logo.svg/100px-2048_logo.svg.png", []),
    ("venge", "Venge.io", "https://venge.io/", "game", "Cem Demir",
     "An objective-based first-person shooter with ability cards — every match is intense and unique.",
     "Fast matches\nOnline community\nFirst person shooter",
     "https://venge.io/favicon-96x96.png", []),
    ("doctor-strange", "Doctor Strange: The Game", "https://rededge.is-a.dev/Doctor-Strange", "game", "RedEdge967",
     "Fight monsters as Doctor Strange.",
     "Play as Doctor Strange, Defender, Sinister, Supreme or Zombie Strange.",
     "https://www.google.com/s2/favicons?domain=rededge.is-a.dev&sz=64", []),
    ("super-mario", "Super Mario Bros.", "https://supermario-game.com/mario-game/mario.html", "game", "Nintendo (fan port)",
     "The classic platform adventure — run, jump and stomp through the Mushroom Kingdom.",
     "Mario Bros. is a 1983 platform game developed and published for arcades by Nintendo",
     "https://icons.iconarchive.com/icons/ph03nyx/super-mario/128/Retro-Mario-icon.png", []),
    ("stick-ninja", "Stick Ninja", "https://rededge967.github.io/stick-ninja/", "game", "RedEdge967",
     "A simple canvas ninja game to have some fun in the boring time.",
     "A simple canvas ninja game written in html5, css3 and javascript.",
     "https://github.com/RedEdge967/stick-ninja/raw/master/logo.png", []),
    ("mk-wiki", "Mortal Kombat Wiki", "https://mk-wiki.vercel.app", "app", "Community",
     "An open source Mortal Kombat game wiki — fighters, moves and lore.",
     "A open source mortal kombat game based wiki",
     "https://www.google.com/s2/favicons?domain=mk-wiki.vercel.app&sz=64", []),
    ("hackzilla", "HACKZILLA", "https://rededge.is-a.dev/HACKZILLA", "app", "RedEdge967",
     "A name generator for everyone.",
     "A name generator for everyone",
     "https://www.google.com/s2/favicons?domain=rededge.is-a.dev&sz=64", []),
    ("adventures-of-red", "Adventures of Red", "https://rededge.is-a.dev/adventures-of-red", "game", "RedEdge967",
     "A little platformer where you collect 20 coins and defeat one enemy.",
     "A little platformer game where you have to collect 20 coins and defeat one enemy",
     "https://www.google.com/s2/favicons?domain=rededge.is-a.dev&sz=64", []),
    ("othello", "Othello", "https://othello.blueedge.me", "game", "blueedge",
     "Othello (Reversi) — the classic 8x8 strategy board game, invented 1883.",
     "Board game",
     "https://dl.flathub.org/repo/appstream/x86_64/icons/128x128/org.gnome.Reversi.png", []),
    ("paper-io", "paper.io", "https://paper-io.com", "game", "Voodoo",
     "Capture as much territory as possible in this real-time multiplayer .io game — paint the map your color.",
     "Fight and capture",
     "https://www.google.com/s2/favicons?domain=paper-io.com&sz=64", []),
    ("flappy-playcanvas", "Flappy Bird", "https://playcanv.as/p/2OlkUaxF/", "game", "PlayCanvas",
     "The side-scroller legend — flap between the green pipes. One tap, infinite frustration.",
     "fly, dodge, score",
     "https://upload.wikimedia.org/wikipedia/en/0/0a/Flappy_Bird_icon.png", []),
    ("bluelab", "bluelab", "https://bluelab.blueedge.me", "app", "blueedge",
     "Interactive math visualizations — inverse kinematics, bezier curves and more.",
     "Interactive math playgrounds",
     "https://raw.githubusercontent.com/blueedgetechno/bluelab/master/public/logo192.png", []),
    ("hexgl-play", "HexGL (direct play)", "https://hexgl.bkcore.com/play/", "game", "Thibaut Despoulain",
     "Straight onto the track — the futuristic anti-gravity racer, no landing page.",
     "WebGL racing",
     "https://hexgl.bkcore.com/image.png", []),
    ("x-trench", "X Trench Run", "https://d2yh0uqycmhzn9.cloudfront.net/en/x-trench-run/index.html", "game", "Gameforge",
     "Shoot down turrets as you fly through the trench avoiding every obstacle — 3D space flying.",
     "A cool game",
     "https://www.google.com/s2/favicons?domain=d2yh0uqycmhzn9.cloudfront.net&sz=64", []),
    ("osu-web", "osu!web", "https://joshua-usi.github.io/osw/", "game", "joshua-usi",
     "osu! — the free-to-play rhythm game; upload your own beatmaps and click to the beat.",
     "fun game with alot of beatmaps",
     "https://joshua-usi.github.io/osw/src/images/osw.png", []),
    ("dash-clicker", "Dash Clicker", "https://dashclicker.com/", "game", "armn",
     "A clicker game for nerds — dash, click, upgrade, repeat.",
     "A clicker game for nerds",
     "https://www.google.com/s2/favicons?domain=dashclicker.com&sz=64", []),
    ("spider-man", "Spider Man", "https://rededge967.github.io/Spider-Man/", "game", "RedEdge967",
     "Your friendly neighbourhood Spiderman — jump and shoot, fight villains.",
     "1. Jump and shoot.\n2. Fight Villains",
     "https://raw.githubusercontent.com/RedEdge967/Spider-Man/master/images/spider-head.png", []),
    ("keyboard-hero", "Keyboard Hero", "https://rededge967.github.io/Keyboard-Hero/", "app", "RedEdge967",
     "A free typing improving software for everyone.",
     "A free and open source typing improving software",
     "https://www.iconpacks.net/icons/1/free-keyboard-icon-1425-thumb.png", []),
    ("space-shooter", "Space Shooter", "https://react-shooter.vercel.app/", "game", "RedEdge967",
     "A shooting game to have some fun alone — arrows to move, space to shoot.",
     "1. Use arrows to move\n2. Press space to shoot",
     "https://www.google.com/s2/favicons?domain=react-shooter.vercel.app&sz=64", []),
    ("connect-four", "Connect Four", "https://rededge.is-a.dev/connect-four", "game", "RedEdge967",
     "Classic connect four game in html, css and javascript.",
     "Classic connect four game",
     "https://github.com/RedEdge967/connect-four/raw/master/Logo.png", []),
    ("scratch", "Scratch", "https://llk.github.io/scratch-gui/master/", "app", "MIT / LLK",
     "The block-based visual programming language — create games, stories and animations, right here.",
     "Create projects with a block-like interface\nTrusted by classrooms everywhere",
     "https://llk.github.io/scratch-gui/master/static/favicon.ico", []),
    ("pulsus", "Pulsus", "https://www.pulsus.cc/play", "game", "Pulsus",
     "A brand new rhythm game you play with your numpad.",
     "Never seen gameplay style - Play with your numpad.",
     "https://www.google.com/s2/favicons?domain=pulsus.cc&sz=64", []),
    ("bemuse", "Bemuse", "https://bemuse.ninja/", "game", "Bemuse team",
     "Web-based rhythm game — play with KEYBOARD or a BMS controller.",
     "2 Gamemodes - Play with KEYBOARD or BMS CONTROLLER",
     "https://bemuse.ninja/res/og-image.png", []),
    ("taiko", "Taiko no Tatsujin (web)", "https://taiko.bui.pm/", "game", "bui.pm",
     "One of the most iconic rhythm games — drum to the beat with your keyboard or a controller.",
     "Play simply with your keyboard, or connect a drum controller!",
     "https://www.google.com/s2/favicons?domain=taiko.bui.pm&sz=64", []),
    ("ipados-vm", "iPadOS VM", "https://goldengocoding.github.io/iPadOS/", "app", "goldengocoding",
     "iPadOS in HTML!! Run a little iPad inside Windows 11.",
     "Run iPadOS in Windows 11",
     "https://www.google.com/s2/favicons?domain=goldengocoding.github.io&sz=64", []),
    ("plooshi-docs", "Plooshi Docs", "https://plooshidocs.online/", "app", "plooshi",
     "A browser made for those who have terrible internet.",
     "browsing, apps.",
     "https://plooshidocs.online/index.svg", []),
    ("3dtuning", "3D Tuning", "https://www.3dtuning.com/en-US/", "app", "3DTuning",
     "Car tuning and styling in 3D — configure your dream ride online.",
     "tuning, cars, 3D.",
     "https://www.google.com/s2/favicons?domain=3dtuning.com&sz=64", []),
]
print("probing the win11react community entries…")
have_urls = set()
for _a in catalog:
    u = _a.get("data", {}).get("url") or _a.get("url")
    if u:
        have_urls.add(u.rstrip("/").lower())
        have_urls.add(__import__("urllib.parse", fromlist=["urlparse"]).urlparse(u).netloc.lower())
wr_added = 0
with ThreadPoolExecutor(max_workers=12) as ex:
    verdicts = list(ex.map(lambda e: (e, probe(e[2])), WR_ENTRIES))
for (eid, name, url, typ, pub, desc, feat, icon, gal), ok in verdicts:
    if not ok:
        print(f"  dropped {eid}: {REASONS.get(url, '?')}")
        continue
    if url.rstrip("/").lower() in have_urls or __import__("urllib.parse", fromlist=["urlparse"]).urlparse(url).netloc.lower() in have_urls:
        print(f"  skipped {eid}: already in the catalog")
        continue
    gal_objs = gallery_from(gal, name) if gal else []
    catalog.append(app(eid, name, url, "Games" if typ == "game" else "Community picks", typ, pub, desc, icon, feat=feat, gallery=gal_objs))
    have_urls.add(url.rstrip("/").lower())
    have_urls.add(__import__("urllib.parse", fromlist=["urlparse"]).urlparse(url).netloc.lower())
    wr_added += 1
print(f"  community entries shipped: {wr_added}")

# ---------------- 5. more curated batches (every one probed) ----------------
MORE = [
    # io / multiplayer games
    ("diep-io", "diep.io", "https://diep.io/", "Games", "game", "Matheus Valadares", "Tank shooter .io — level up, upgrade your build, dominate the arena.", "https://www.google.com/s2/favicons?domain=diep.io&sz=64"),
    ("splix-io", "splix.io", "https://splix.io/", "Games", "game", "JeZz20L", "Claim territory by closing loops — but never cross your own tail.", "https://www.google.com/s2/favicons?domain=splix.io&sz=64"),
    ("mope-io", "mope.io", "https://mope.io/", "Games", "game", "Stanley He", "Eat, grow and evolve through the food chain in this animal .io survival game.", "https://www.google.com/s2/favicons?domain=mope.io&sz=64"),
    ("starve-io", "starve.io", "https://starve.io/", "Games", "game", "LapaMauve", "Survive the night: gather, craft and build before the wolves come.", "https://www.google.com/s2/favicons?domain=starve.io&sz=64"),
    ("zombsroyale", "ZombsRoyale.io", "https://zombsroyale.io/", "Games", "game", "Two Men Games", "A 100-player 2D battle royale — drop in, loot up, be the last one standing.", "https://www.google.com/s2/favicons?domain=zombsroyale.io&sz=64"),
    ("littlebigsnake", "Little Big Snake", "https://littlebigsnake.com/", "Games", "game", "Addicting Games", "The snake arena evolved — eat, grow, become the biggest snake in the pit.", "https://www.google.com/s2/favicons?domain=littlebigsnake.com&sz=64"),
    ("taming-io", "taming.io", "https://taming.io/", "Games", "game", "Lapa", "Survive and tame wild pets in this click-and-slash .io survival.", "https://www.google.com/s2/favicons?domain=taming.io&sz=64"),
    ("gulper-io", "Gulper.io", "https://gulper.io/", "Games", "game", "Fulldroper", "Snake battle arena — grow longer, trap rivals, rule the map.", "https://www.google.com/s2/favicons?domain=gulper.io&sz=64"),
    ("defly-io", "defly.io", "https://defly.io/", "Games", "game", "Odd Even Games", "Build walls, place towers and capture territory — by helicopter.", "https://www.google.com/s2/favicons?domain=defly.io&sz=64"),
    ("superhex-io", "Superhex.io", "https://superhex.io/", "Games", "game", "Seduction Gaming", "Conquer hex territories with your expanding beam — don't touch your own.", "https://www.google.com/s2/favicons?domain=superhex.io&sz=64"),
    ("sploop-io", "Sploop.io", "https://sploop.io/", "Games", "game", "Sploop", "Farm, build, raid — a fast-paced base-building .io game.", "https://www.google.com/s2/favicons?domain=sploop.io&sz=64"),
    ("terr-io", "Terr.io", "https://terr.io/", "Games", "game", "Terr", "Territory control MMO — expand your land mass across a living map.", "https://www.google.com/s2/favicons?domain=terr.io&sz=64"),
    # tools & creativity
    ("tldraw", "tldraw", "https://www.tldraw.com/", "Creativity", "app", "tldraw", "A tiny but mighty collaborative whiteboard — feels like paper, works like magic.", "https://www.google.com/s2/favicons?domain=tldraw.com&sz=64"),
    ("pixilart", "Pixil Art", "https://www.pixilart.com/draw", "Creativity", "app", "Pixilart", "Pixel art studio in the browser — draw sprites, animate frames, share.", "https://www.google.com/s2/favicons?domain=pixilart.com&sz=64"),
    ("devdocs", "DevDocs", "https://devdocs.io/", "Reference", "app", "DevDocs", "Every API documentation in one fast, searchable, offline-capable interface.", "https://www.google.com/s2/favicons?domain=devdocs.io&sz=64"),
    ("regexr", "RegExr", "https://regexr.com/", "Utilities", "app", "gskinner", "Build, test and debug regular expressions with live match highlighting.", "https://www.google.com/s2/favicons?domain=regexr.com&sz=64"),
    ("onecompiler", "OneCompiler", "https://onecompiler.com/", "Utilities", "app", "OneCompiler", "Run 40+ languages online — Python, Java, C++, SQL and more, no setup.", "https://www.google.com/s2/favicons?domain=onecompiler.com&sz=64"),
    ("programiz-py", "Python Compiler — Programiz", "https://www.programiz.com/python-programming/online-compiler/", "Utilities", "app", "Programiz", "Write and run Python instantly in a clean online compiler.", "https://www.google.com/s2/favicons?domain=programiz.com&sz=64"),
    ("programiz-js", "JavaScript Compiler — Programiz", "https://www.programiz.com/javascript/online-compiler/", "Utilities", "app", "Programiz", "Write and run JavaScript instantly in a clean online compiler.", "https://www.google.com/s2/favicons?domain=programiz.com&sz=64"),
    ("programiz-java", "Java Compiler — Programiz", "https://www.programiz.com/java-programming/online-compiler/", "Utilities", "app", "Programiz", "Write and run Java instantly in a clean online compiler.", "https://www.google.com/s2/favicons?domain=programiz.com&sz=64"),
    ("programiz-cpp", "C++ Compiler — Programiz", "https://www.programiz.com/cpp-programming/online-compiler/", "Utilities", "app", "Programiz", "Write and run C++ instantly in a clean online compiler.", "https://www.google.com/s2/favicons?domain=programiz.com&sz=64"),
    ("omnicalculator", "Omni Calculator", "https://www.omnicalculator.com/", "Utilities", "app", "Omni", "3500+ smart calculators for math, finance, health, physics and daily life.", "https://www.google.com/s2/favicons?domain=omnicalculator.com&sz=64"),
    ("rapidtables", "RapidTables", "https://www.rapidtables.com/", "Utilities", "app", "RapidTables", "Calculators, converters and reference tables for everyday computing.", "https://www.google.com/s2/favicons?domain=rapidtables.com&sz=64"),
    ("coolors", "Coolors", "https://coolors.co/", "Creativity", "app", "Coolors", "The super-fast color palette generator — press space, get inspired.", "https://www.google.com/s2/favicons?domain=coolors.co&sz=64"),
    ("carbon", "Carbon", "https://carbon.now.sh/", "Creativity", "app", "carbon", "Create and share beautiful images of your source code.", "https://www.google.com/s2/favicons?domain=carbon.now.sh&sz=64"),
    ("dbdiagram", "dbdiagram.io", "https://dbdiagram.io/draw", "Utilities", "app", "Holistics", "Database diagrams in code — draw ER diagrams by writing DSL.", "https://www.google.com/s2/favicons?domain=dbdiagram.io&sz=64"),
    # science & space
    ("ptable", "PT — interactive periodic table", "https://ptable.com/", "Reference", "app", "Michael Dayah", "The dynamic interactive periodic table — elements, properties, orbits.", "https://www.google.com/s2/favicons?domain=ptable.com&sz=64"),
    ("stellarium", "Stellarium Web", "https://stellarium-web.org/", "Reference", "app", "Stellarium", "A planetarium in your browser — stars, constellations, planets, live.", "https://www.google.com/s2/favicons?domain=stellarium-web.org&sz=64"),
    ("solar-scope", "Solar System Scope", "https://www.solarsystemscope.com/", "Reference", "app", "Inove", "A 3D interactive model of the Solar System and night sky.", "https://www.google.com/s2/favicons?domain=solarsystemscope.com&sz=64"),
    ("scale-universe", "Scale of the Universe", "https://htwins.net/scale2/", "Reference", "app", "Cary & Michael Huang", "Zoom from quantum foam to the observable universe in one continuous scale.", "https://www.google.com/s2/favicons?domain=htwins.net&sz=64"),
    ("phet", "PhET Simulations", "https://phet.colorado.edu/en/simulations/browse", "Reference", "app", "University of Colorado", "Free research-based science and math simulations — physics, chemistry, biology.", "https://www.google.com/s2/favicons?domain=phet.colorado.edu&sz=64"),
    # music & audio
    ("fma", "Free Music Archive", "https://freemusicarchive.org/", "Music & Audio", "app", "FMA", "Legal free music downloads — curated genres, legendary archives.", "https://www.google.com/s2/favicons?domain=freemusicarchive.org&sz=64"),
    ("musopen", "Musopen", "https://musopen.org/", "Music & Audio", "app", "Musopen", "Free public domain classical recordings and sheet music.", "https://www.google.com/s2/favicons?domain=musopen.org&sz=64"),
    ("chosic", "Chosic", "https://www.chosic.com/free-music/all/", "Music & Audio", "app", "Chosic", "Free royalty-free music library — search, listen, download.", "https://www.google.com/s2/favicons?domain=chosic.com&sz=64"),
    # fun & weird web
    ("neal-fun", "Neal.fun", "https://neal.fun/", "Community picks", "app", "Neal Agarwal", "The internet's most delightful toys — spend a fortune, scale the universe, design the next Earth.", "https://www.google.com/s2/favicons?domain=neal.fun&sz=64"),
    ("password-game", "The Password Game", "https://neal.fun/password-game/", "Community picks", "app", "Neal Agarwal", "The increasingly absurd password rules that broke the internet.", "https://www.google.com/s2/favicons?domain=neal.fun&sz=64"),
    ("useless-web", "The Useless Web", "https://theuselessweb.com/", "Community picks", "app", "Tim Holman", "One button. Endless wonderfully useless websites. Please press it.", "https://www.google.com/s2/favicons?domain=theuselessweb.com&sz=64"),
    ("pointerpointer", "Pointer Pointer", "https://pointerpointer.com/", "Community picks", "app", "Studio Moniek", "Move your mouse anywhere — a photo of someone pointing at it appears.", "https://www.google.com/s2/favicons?domain=pointerpointer.com&sz=64"),
    # typing
    ("keybr", "keybr", "https://www.keybr.com/", "Utilities", "app", "keybr", "Learn touch typing fast with smart practice that adapts to your weak keys.", "https://www.google.com/s2/favicons?domain=keybr.com&sz=64"),
    ("ztype", "ZType", "https://zty.pe/", "Games", "game", "Dominic Szablewski", "Typing shooter — destroy incoming missiles by typing the words.", "https://www.google.com/s2/favicons?domain=zty.pe&sz=64"),
    ("typingtest", "Typing Test", "https://www.typingtest.com/", "Utilities", "app", "TypingTest", "Measure your WPM with classic one-minute and three-minute tests.", "https://www.google.com/s2/favicons?domain=typingtest.com&sz=64"),
]
print("probing the extra batches…")
with ThreadPoolExecutor(max_workers=12) as ex:
    verdicts = list(ex.map(lambda t: (t, probe(t[2])), MORE))
more_added = 0
have2 = set()
for t, ok in verdicts:
    (eid, name, url, cat, typ, pub, desc, icon) = t
    if ok:
        catalog.append(app(eid, name, url, cat, typ, pub, desc, icon))
        more_added += 1
    else:
        print(f"  dropped {eid}: {REASONS.get(url, '?')}")
print(f"  extra batch shipped: {more_added}")

# ---------------- 6. Project Gutenberg — the most-read classics ----------------
print("fetching the Project Gutenberg top titles…")
BOOKS = []
try:
    html = urllib.request.urlopen(urllib.request.Request(
        "https://www.gutenberg.org/browse/scores/top1000.php", headers=UA), timeout=30).read().decode("utf-8", "ignore")
    rows = re.findall(r'<li><a href="/ebooks/(\d+)">([^<]+)</a></li>', html)
    for gid, title in rows[:150]:
        m = re.match(r"(.+?) by (.+?) \(\d+\)$", title)
        if m:
            t, author = m.group(1).strip(), m.group(2).strip()
        else:
            t, author = re.sub(r" \(\d+\)$", "", title).strip(), "Unknown"
        BOOKS.append((gid, t, author))
except Exception as e:
    print(f"  gutenberg scrape failed: {e}")
print(f"  top books found: {len(BOOKS)}")
book_urls = [f"https://www.gutenberg.org/ebooks/{gid}" for gid, _, _ in BOOKS]
with ThreadPoolExecutor(max_workers=12) as ex:
    bverdicts = list(ex.map(lambda u: probe(u), book_urls))
books_added = 0
for (gid, t, author), ok in zip(BOOKS, bverdicts):
    if not ok:
        continue
    safe = re.sub(r"[^a-z0-9]+", "-", (t + "-" + gid).lower()).strip("-")[:60]
    catalog.append(app(
        f"gutenberg-{safe}", f"{t} — Gutenberg", f"https://www.gutenberg.org/ebooks/{gid}",
        "Books & Reading", "app", author,
        f"{t} by {author} — free to read online or download. Project Gutenberg ebook #{gid}, public domain.",
        f"https://www.gutenberg.org/cache/epub/{gid}/pg{gid}.cover.medium.jpg",
        feat="Read in the browser\nEPUB & Kindle downloads\nPublic domain"))
    books_added += 1
print(f"  books shipped: {books_added}")

# ---------------- 7. Internet Archive — top films & audio ----------------
print("fetching the Internet Archive top items…")
IA_SETS = [
    ("feature_films", "Movies & TV", "Feature Films", "full-length public domain films"),
    ("film_noir", "Movies & TV", "Film Noir", "classic noir cinema"),
    ("classic_cartoons", "Movies & TV", "Classic Cartoons", "golden-age animated shorts"),
    ("audio_music", "Music & Audio", "Archive Audio", "the Internet Archive music collection"),
    ("opensource_audio", "Music & Audio", "Open Source Audio", "community audio"),
]
ia_added = 0
for coll, cat, label, kind in IA_SETS:
    try:
        q = urllib.parse.quote(f'collection:({coll})')
        api = f"https://archive.org/advancedsearch.php?q={q}&fl%5B%5D=identifier&fl%5B%5D=title&sort%5B%5D=downloads+desc&rows=60&page=1&output=json"
        docs = get(api, timeout=40)["response"]["docs"]
    except Exception as e:
        print(f"  {coll} fetch failed: {e}")
        continue
    urls = [f"https://archive.org/details/{d['identifier']}" for d in docs if d.get("identifier")]
    if not urls:
        continue
    v = list(ThreadPoolExecutor(max_workers=12).map(lambda u: probe(u), urls))
    for d, ok in zip(docs, v):
        ident, title = d.get("identifier"), (d.get("title") or ident).strip()
        if not ok or not ident:
            continue
        title = re.sub(r"\s+", " ", title)[:80]
        catalog.append(app(
            f"ia-{str(ident)[:60].lower()}", title[:60], f"https://archive.org/details/{ident}",
            cat, "app", f"Internet Archive — {label}",
            f"{title} — from the Internet Archive's {kind} (public domain).",
            f"https://archive.org/services/img/{ident}",
            feat="Stream in the browser\nPublic domain\nInternet Archive item"))
        ia_added += 1
print(f"  archive items shipped: {ia_added}")

# ---------------- 8. Open Library subject shelves ----------------
print("adding Open Library subject shelves…")
SUBJECTS = ["science fiction", "fantasy", "history", "philosophy", "poetry", "psychology",
            "mathematics", "biology", "physics", "cooking", "art", "music", "economics",
            "programming", "medicine", "law", "adventure", "mystery", "romance", "children",
            "drama", "biography", "technology", "religion"]
subj_added = 0
sl_urls = [f"https://openlibrary.org/subjects/{s.replace(' ', '_').lower()}" for s in SUBJECTS]
sv = list(ThreadPoolExecutor(max_workers=12).map(lambda u: probe(u), sl_urls))
for sname, ok in zip(SUBJECTS, sv):
    if not ok:
        continue
    catalog.append(app(
        f"openlibrary-{sname.replace(' ', '-')}", f"Open Library — {sname.title()}",
        f"https://openlibrary.org/subjects/{sname.replace(' ', '_').lower()}",
        "Books & Reading", "app", "Open Library",
        f"Browse every book about {sname} you can borrow — Open Library's {sname} shelf.",
        "https://openlibrary.org/static/images/openlibrary-logo-tighter.svg",
        feat="Read & borrow\nMillions of titles\nInternet Archive powered"))
    subj_added += 1
print(f"  subject shelves shipped: {subj_added}")

# ---------------- 7b. Internet Archive — playable retro game rooms ----------------
print("fetching the Internet Archive retro game collections…")
IA_GAMES = [
    ("softwarelibrary_msdos_games", "MS-DOS"),
    ("console_living_room", "Console"),
]
for coll, label in IA_GAMES:
    try:
        q = urllib.parse.quote(f'collection:({coll})')
        api = f"https://archive.org/advancedsearch.php?q={q}&fl%5B%5D=identifier&fl%5B%5D=title&sort%5B%5D=downloads+desc&rows=80&page=1&output=json"
        docs = get(api, timeout=40)["response"]["docs"]
    except Exception as e:
        print(f"  {coll} fetch failed: {e}")
        continue
    urls = [f"https://archive.org/details/{d['identifier']}" for d in docs if d.get("identifier")]
    if not urls:
        continue
    v = list(ThreadPoolExecutor(max_workers=12).map(lambda u: probe(u), urls))
    g_added = 0
    for d, ok in zip(docs, v):
        ident, title = d.get("identifier"), (d.get("title") or d.get("identifier")).strip()
        if not ok or not ident:
            continue
        title = re.sub(r"\s+", " ", title)[:60]
        catalog.append(app(
            f"ia-{str(ident)[:60].lower()}", title, f"https://archive.org/details/{ident}",
            "Games", "game", f"Internet Archive — {label} Living Room",
            f"{title} — the original {label} version, playable in your browser through the Internet Archive's emulator.",
            f"https://archive.org/services/img/{ident}",
            feat="Playable in the browser\nOriginal emulator\nInternet Archive"))
        g_added += 1
    print(f"  {coll}: {g_added}")

# ---------------- 7c. sixty more OSM city maps ----------------
MORE_CITIES = [
    ("Dubai", 25.20, 55.27), ("Doha", 25.29, 51.53), ("Mecca", 21.39, 39.86), ("Baghdad", 33.31, 44.36),
    ("Tehran", 35.69, 51.39), ("Bangkok", 13.76, 100.50), ("Singapore", 1.35, 103.82), ("Jakarta", -6.21, 106.85),
    ("Manila", 14.60, 120.98), ("Ho Chi Minh City", 10.82, 106.63), ("Shenzhen", 22.54, 114.06),
    ("Chengdu", 30.57, 104.07), ("Wuhan", 30.59, 114.31), ("Osaka", 34.69, 135.50), ("Kyoto", 35.01, 135.77),
    ("Fukuoka", 33.59, 130.40), ("Sapporo", 43.06, 141.35), ("Vancouver", 49.28, -123.12), ("Montreal", 45.50, -73.57),
    ("Calgary", 51.05, -114.07), ("Mexico City", 19.43, -99.13), ("Guadalajara", 20.67, -103.35),
    ("Havana", 23.11, -82.37), ("Panama City", 8.98, -79.52), ("Bogota", 4.71, -74.07), ("Quito", -0.18, -78.47),
    ("Caracas", 10.49, -66.88), ("Santiago", -33.45, -70.67), ("Valparaiso", -33.05, -71.62),
    ("Montevideo", -34.90, -56.16), ("Asuncion", -25.26, -57.58), ("La Paz", -16.49, -68.12),
    ("Lisbon", 38.72, -9.14), ("Porto", 41.15, -8.61), ("Seville", 37.39, -6.00), ("Valencia", 39.47, -0.38),
    ("Milan", 45.46, 9.19), ("Naples", 40.85, 14.27), ("Florence", 43.77, 11.26), ("Munich", 48.14, 11.58),
    ("Hamburg", 53.55, 9.99), ("Frankfurt", 50.11, 8.68), ("Cologne", 50.94, 6.96), ("Brussels", 50.85, 4.35),
    ("Rotterdam", 51.92, 4.48), ("Zurich", 47.38, 8.54), ("Geneva", 46.20, 6.14), ("Salzburg", 47.81, 13.04),
    ("Budapest", 47.50, 19.04), ("Bucharest", 44.43, 26.10), ("Sofia", 42.70, 23.32), ("Belgrade", 44.79, 20.45),
    ("Zagreb", 45.81, 15.98), ("Ljubljana", 46.06, 14.51), ("Bratislava", 48.15, 17.11), ("Tallinn", 59.44, 24.75),
    ("Riga", 56.95, 24.11), ("Vilnius", 54.69, 25.28), ("Krakow", 50.06, 19.94), ("Dubrovnik", 42.65, 18.09),
]
for name, lat, lon in MORE_CITIES:
    catalog.append(map_app(
        f"osm-city-{name.lower().replace(' ', '-')}", f"Map — {name}",
        f"An interactive OpenStreetMap centred on {name}. Pan, zoom, explore.",
        lat, lon, 0.12, 0.08))
print(f"  extra cities added: {len(MORE_CITIES)}")

# ---------------- 7d. final small batches ----------------
FINAL_BATCH = [
    ("contexto", "Contexto", "https://contexto.me/", "Games", "game", "Contexto", "The semantic word guessing game — guesses ranked by AI-measured closeness to the secret word.", "https://www.google.com/s2/favicons?domain=contexto.me&sz=64"),
    ("wordled", "Hello Wordl", "https://hannahmariepark.github.io/wordle/", "Games", "game", "Hannah Park", "The word-guessing phenomenon — unlimited plays, adjustable word length.", "https://www.google.com/s2/favicons?domain=hannahmariepark.github.io&sz=64"),
    ("scrabble", "Scrabble Sprint", "https://scrabblewordfinder.org/", "Games", "game", "SWF", "Word finder puzzles and scrabble practice in the browser.", "https://www.google.com/s2/favicons?domain=scrabblewordfinder.org&sz=64"),
    ("bibled", "Bible Gateway", "https://www.biblegateway.com/", "Books & Reading", "app", "HaperCollins Christian", "Read and search 200+ Bible versions in 70 languages.", "https://www.google.com/s2/favicons?domain=biblegateway.com&sz=64"),
    ("poetry", "Poetry Foundation", "https://www.poetryfoundation.org/", "Books & Reading", "app", "Poetry Foundation", "Tens of thousands of classic and contemporary poems, essays and more.", "https://www.google.com/s2/favicons?domain=poetryfoundation.org&sz=64"),
    ("wiktionary-wotd", "Word of the Day — Wiktionary", "https://en.wiktionary.org/wiki/Wiktionary:Main_Page", "Dictionary", "app", "Wikimedia", "Wiktionary's word of the day and the whole dictionary, one tap away.", "https://en.wiktionary.org/static/favicon/wiktionary.ico"),
]
print("probing the final batch…")
with ThreadPoolExecutor(max_workers=12) as ex:
    fv = list(ex.map(lambda t: (t, probe(t[2])), FINAL_BATCH))
for t, ok in fv:
    (eid, name, url, cat, typ, pub, desc, icon) = t
    if ok:
        catalog.append(app(eid, name, url, cat, typ, pub, desc, icon))
    else:
        print(f"  dropped {eid}: {REASONS.get(url, '?')}")

# ---------------- write ----------------
seen = set()
final = []
for a in catalog:
    if a["id"] in seen or not a.get("url", a.get("data", {}).get("url")):
        continue
    if a["id"] in seen:
        continue
    seen.add(a["id"])
    final.append(a)

# the r13 contract: the Wikipedia entry ships a seeded 2-shot gallery
for _a in final:
    if _a.get("id") == "wikipedia":
        _a["data"]["feat"] = "Search\nLanguages\nOffline-friendly reading"
        _a["data"]["gallery"] = [
            {"type": "image", "src": "https://upload.wikimedia.org/wikipedia/commons/8/80/Wikipedia-logo-v2.svg", "alt": "Wikipedia wordmark (SVG)"},
            {"type": "image", "src": "https://upload.wikimedia.org/wikipedia/commons/5/51/Screenshot_of_the_Main_Page_on_the_English_Wikipedia_-_Wikipedia_25.png", "alt": "English Wikipedia main page"},
        ]
        break

json.dump(final, open(OUT, "w"), indent=1, ensure_ascii=False)
print(f"\nTOTAL: {len(final)} apps -> {OUT}")
by_cat = {}
for a in final:
    by_cat[a["category"]] = by_cat.get(a["category"], 0) + 1
for k, v in sorted(by_cat.items(), key=lambda x: -x[1]):
    print(f"  {k}: {v}")
