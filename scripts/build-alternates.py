#!/usr/bin/env python3
"""Tells search engines which pages are the same page in another language.
   Every page gets one <link rel="alternate" hreflang> per language it exists in,
   plus x-default pointing at English, and sitemap.xml is rebuilt from the files
   on disk with the same alternates. Run after anything adds or removes a page.
       python3 scripts/build-alternates.py
"""
import datetime, glob, os, re
from sitelib import LANGS, SITE, FOLDER, file_in, url_of, translations

SKIP = {'404.html', 'thank-you.html'}            # not for the index
PRIORITY = {'index.html': '1.0', 'costs.html': '0.9', 'countries.html': '0.9'}
ALT = re.compile(r'\n<link rel="alternate" hreflang="[^"]*" href="[^"]*" />')

def rel_pages():
    """Every page path, relative to its language folder, that exists in English."""
    pages = glob.glob('*.html') + glob.glob('countries/*.html') + glob.glob('blog/*.html') + glob.glob('blog/page/*.html')
    return sorted(p for p in pages if p != 'index.html') + ['index.html']

def alternates(relpath):
    tr = translations(relpath)
    links = [(c, tr[c]) for c, *_ in LANGS if c in tr]
    if 'en' in tr: links.append(('x-default', tr['en']))
    return links

# ---- heads ------------------------------------------------------------------
changed = 0
for relpath in rel_pages():
    links = alternates(relpath)
    block = ''.join('\n<link rel="alternate" hreflang="%s" href="%s%s" />' % (c, SITE, u) for c, u in links)
    for code, *_ in LANGS:
        f = file_in(code, relpath)
        if not os.path.exists(f): continue
        s = open(f, encoding='utf-8').read()
        new = ALT.sub('', s)
        if relpath not in SKIP:
            m = re.search(r'<link rel="canonical" href="[^"]*" />', new)
            if m: new = new[:m.end()] + block + new[m.end():]
        if new != s:
            open(f, 'w', encoding='utf-8').write(new); changed += 1

# ---- sitemap ----------------------------------------------------------------
old = open('sitemap.xml', encoding='utf-8').read()
lastmod = dict(re.findall(r'<loc>([^<]+)</loc><lastmod>([^<]+)</lastmod>', old))
today = datetime.date.today().isoformat()

rows = []
for relpath in rel_pages():
    if relpath in SKIP: continue
    links = alternates(relpath)
    alt = ''.join('<xhtml:link rel="alternate" hreflang="%s" href="%s%s"/>' % (c, SITE, u) for c, u in links)
    if relpath.startswith('blog/page/'):   pri = '0.3'
    elif relpath.startswith('blog/'):      pri = '0.6'
    else:                                  pri = PRIORITY.get(relpath, '0.7')
    for code, u in links:
        if code == 'x-default': continue
        loc = SITE + u
        f = file_in(code, relpath)
        iso = re.search(r'article:published_time" content="(\d{4}-\d\d-\d\d)', open(f, encoding='utf-8').read())
        mod = lastmod.get(loc) or (iso.group(1) if iso else today)
        rows.append('  <url><loc>%s</loc><lastmod>%s</lastmod><priority>%s</priority>%s</url>' % (loc, mod, pri, alt))

xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
       '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
       + '\n'.join(rows) + '\n</urlset>\n')
open('sitemap.xml', 'w', encoding='utf-8').write(xml)
print('%d page(s) got their hreflang links rewritten; sitemap has %d URLs' % (changed, len(rows)))
