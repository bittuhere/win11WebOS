"""Literal URL inventory, NOT a claim that every URL is fetched at runtime.
Run: python scripts/audit-network.py
"""
from pathlib import Path
from urllib.parse import urlsplit
import re, csv, json, collections
root = Path(__file__).resolve().parents[1]
rows = set()
for folder in ['src', 'public']:
    for file in (root / folder).rglob('*'):
        if file.suffix not in {'.js','.jsx','.css','.scss','.html','.json','.svg'}: continue
        text = file.read_text(errors='replace')
        for number, line in enumerate(text.splitlines(), 1):
            for url in re.findall(r'https?://[^\s\x22\x27<>`\\)]+', line):
                try: host = urlsplit(url).hostname
                except ValueError: continue
                if not host or '.' not in host or '{' in host: continue
                name = str(file.relative_to(root))
                if host in {'www.w3.org','schemas.openxmlformats.org','schemas.microsoft.com','purl.org'}: kind='namespace/not-network'
                elif host == 'www.apache.org' or line.strip().startswith(('//','*','<!--')): kind='comment/license/reference'
                elif 'storeCatalog' in name: kind='remote-store-catalog (URLs/icons; optional)'
                elif 'assets/store.json' in name or 'assets/songs.json' in name or 'assets/jiosaavn.js' in name: kind='legacy data/module (not imported by current app)'
                elif 'reducers/news.json' in name or 'reducers/history.json' in name: kind='offline fallback article outbound link'
                elif '/surf/resources/js/' in name or '/office/' in name: kind='vendored code reference (review before treating as request)'
                else: kind='runtime-or-navigation (review call site)'
                rows.add((name,number,host,kind,url))
rows = sorted(rows)
with (root/'docs/NETWORK-INVENTORY.csv').open('w',newline='') as f:
    writer=csv.writer(f,lineterminator="\n");writer.writerow(['file','line','host','classification','url']);writer.writerows(rows)
counts=collections.Counter(r[3] for r in rows)
summary={'literal_occurrences':len(rows),'distinct_literal_urls':len({r[4] for r in rows}),'distinct_hosts':len({r[2] for r in rows}),'categories':dict(counts),'note':'Static literals include links, comments, XML namespaces and legacy data; dynamic URLs and remote iframe subresources are not bounded by this count.'}
(root/'docs/NETWORK-SUMMARY.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
