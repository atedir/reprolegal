#!/usr/bin/env python3
"""One header for the whole site. The header and menu drawer of each language's
   home page are copied onto every other page of that language — inner pages,
   country pages, the journal and its articles. Inner pages get the solid header
   and a contact link that points back at the home page, and on every page the
   language menu leads to this same page in each language (or that language's home
   page where there is no translation).
       python3 scripts/sync-header.py           rewrite pages that drifted
       python3 scripts/sync-header.py --check   only report them (exits 1), for CI
"""
import glob, os, re, sys
from sitelib import LANGS as SITE_LANGS, rel, translations

CHECK = '--check' in sys.argv
LANGS = ['', 'ua', 'de', 'fr', 'es', 'it']

def chrome(s):
    """(start, end) of the header-plus-drawer run, or None."""
    if '<header' not in s or '<div class="drawer"' not in s: return None
    a = s.index('<header')
    b = s.index('</div>', s.index('</nav>', s.index('<div class="drawer"'))) + 6
    return a, b

def inner(block, home):
    block = block.replace('<header id="hdr">', '<header id="hdr" class="solid">', 1)
    return re.sub(r'href="#contact"', 'href="%s#contact"' % home, block)

def switcher(block, f):
    """Point each entry of the language menu at this page in that language."""
    there = translations(rel(f))
    def menu(m):
        items = m.group(1)
        for code, folder, *_ in SITE_LANGS:
            home = '/%s/' % folder if folder else '/'
            items = re.sub(r'<a href="[^"]*"((?: class="on")?)>(%s)</a>' % re.escape(_name[code]),
                           lambda a: '<a href="%s"%s>%s</a>' % (there.get(code, home), a.group(1), a.group(2)), items)
        return '<div class="langmenu">%s</div>' % items
    return re.sub(r'<div class="langmenu">(.*?)</div>', menu, block, count=1, flags=re.S)

_name = {c: n for c, _, n, *_ in SITE_LANGS}

drift = 0
for lang in LANGS:
    home = '/%s/' % lang if lang else '/'
    src = open(os.path.join(lang, 'index.html'), encoding='utf-8').read()
    a, b = chrome(src)
    want = inner(src[a:b], home)
    pages = (glob.glob(os.path.join(lang, '*.html')) + glob.glob(os.path.join(lang, 'countries', '*.html'))
             + glob.glob(os.path.join(lang, 'blog', '*.html')) + glob.glob(os.path.join(lang, 'blog', 'page', '*.html')))
    for f in sorted(set(pages)):
        f = os.path.normpath(f)
        s = open(f, encoding='utf-8').read()
        span = chrome(s)
        if not span:
            print('  ! %s has no header/drawer' % f); drift += 1; continue
        home_page = os.path.basename(f) == 'index.html' and os.path.dirname(f) == lang
        page_want = switcher(src[a:b] if home_page else want, f)
        if s[span[0]:span[1]] == page_want: continue
        drift += 1
        print('  %s %s' % ('drifted' if CHECK else 'synced ', f))
        if not CHECK:
            open(f, 'w', encoding='utf-8').write(s[:span[0]] + page_want + s[span[1]:])

print('\n%d page(s) %s' % (drift, 'with a header that differs from the home page' if CHECK else 'brought in line'))
sys.exit(1 if CHECK and drift else 0)
