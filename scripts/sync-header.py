#!/usr/bin/env python3
"""One header for the whole site. The header and menu drawer of each language's
   home page are copied onto every other page of that language — inner pages,
   country pages and, for English, the journal and its articles. Inner pages get
   the solid header and a contact link that points back at the home page.
       python3 scripts/sync-header.py           rewrite pages that drifted
       python3 scripts/sync-header.py --check   only report them (exits 1), for CI
"""
import glob, os, re, sys

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

drift = 0
for lang in LANGS:
    home = '/%s/' % lang if lang else '/'
    src = open(os.path.join(lang, 'index.html'), encoding='utf-8').read()
    a, b = chrome(src)
    want = inner(src[a:b], home)
    pages = glob.glob(os.path.join(lang, '*.html')) + glob.glob(os.path.join(lang, 'countries', '*.html'))
    if not lang:
        pages += ['blog.html'] + glob.glob('blog/*.html') + glob.glob('blog/page/*.html')
    for f in sorted(set(pages)):
        if os.path.basename(f) == 'index.html' and os.path.dirname(f) == lang: continue
        s = open(f, encoding='utf-8').read()
        span = chrome(s)
        if not span:
            print('  ! %s has no header/drawer' % f); drift += 1; continue
        if s[span[0]:span[1]] == want: continue
        drift += 1
        print('  %s %s' % ('drifted' if CHECK else 'synced ', f))
        if not CHECK:
            open(f, 'w', encoding='utf-8').write(s[:span[0]] + want + s[span[1]:])

print('\n%d page(s) %s' % (drift, 'with a header that differs from the home page' if CHECK else 'brought in line'))
sys.exit(1 if CHECK and drift else 0)
