#!/usr/bin/env python3
"""Build a translated copy of the whole site (blog excluded) for one language.

    python3 scripts/build-lang.py de

Translations live in content/i18n/<code>.json as {"english string": "translation"}.
Anything missing from the dictionary stays in English, so a partial dictionary
still produces a working site.
"""
import re, json, sys, os, glob, shutil

CODE = sys.argv[1]
LANGS = [('en','English','/'),('uk','Українська','/ua/'),('de','Deutsch','/de/'),
         ('fr','Français','/fr/'),('es','Español','/es/'),('it','Italiano','/it/')]
LABEL = {'en':'EN','uk':'UA','de':'DE','fr':'FR','es':'ES','it':'IT'}
DIR   = {'uk':'ua','de':'de','fr':'fr','es':'es','it':'it'}
D = DIR[CODE]

# every page that gets a translated copy; the blog stays English on purpose
PAGES = ['index.html','programmes.html','costs.html','how-it-works.html','countries.html',
         'stories.html','faq.html','thank-you.html','privacy.html','cookies.html','404.html'] \
        + sorted(glob.glob('countries/*.html'))

T = json.load(open('content/i18n/%s.json' % CODE))
META = T.pop('__meta__', {})
EXPL = T.pop('__explorer__', {})
PAGE_META = T.pop('__pages__', {})

KEYS = sorted(T, key=len, reverse=True)          # longest first, so short keys never eat long ones

def localise_links(body):
    """Internal links point at the same language; blog and anchors are left alone."""
    def repl(m):
        href = m.group(1)
        if (href.startswith('/blog') or href.startswith('http') or href.startswith('#')
                or href.startswith('mailto') or href.startswith('/' + D + '/')
                or href in ('/favicon.svg',) or href.startswith('/assets') or href.startswith('/img')):
            return m.group(0)
        if href == '/':
            return 'href="/%s/"' % D
        if href.startswith('/#'):
            return 'href="/%s/%s"' % (D, href[1:])
        if href.startswith('/'):
            return 'href="/%s%s"' % (D, href)
        return m.group(0)
    body = re.sub(r'href="([^"]+)"', repl, body)
    # language roots must never be prefixed: /it/de/ is not a page
    for code in ('ua','de','fr','es','it'):
        body = body.replace('href="/%s/%s/"' % (D, code), 'href="/%s/"' % code)
    return body

def switcher(body, path_suffix):
    body = re.sub(r'<summary aria-label="[^"]*">[^<]*</summary>',
                  '<summary aria-label="Language">%s</summary>' % LABEL[CODE], body, count=1)
    items = ''.join('<a href="%s"%s>%s</a>' % (u, ' class="on"' if c == CODE else '', n)
                    for c, n, u in LANGS)
    return re.sub(r'<div class="langmenu">.*?</div>', '<div class="langmenu">%s</div>' % items,
                  body, flags=re.S, count=1)

count_pages = 0
for page in PAGES:
    src = open(page).read()
    head, body = src.split('<body>', 1)
    out_path = os.path.join(D, page)
    url_path = '/' + D + '/' + (page[:-5] if page != 'index.html' else '')
    url_path = url_path.replace('/index', '/').replace('//', '/')

    # ---- head ----
    meta = PAGE_META.get(page, {})
    if page == 'index.html' and META:
        meta = {'title': META.get('title'), 'description': META.get('description')}
    if meta.get('title'):
        head = re.sub(r'<title>.*?</title>', '<title>%s</title>' % meta['title'], head, flags=re.S)
        head = re.sub(r'<meta property="og:title" content=".*?" />',
                      '<meta property="og:title" content="%s" />' % meta['title'], head, flags=re.S)
    if meta.get('description'):
        head = re.sub(r'<meta name="description" content=".*?" />',
                      '<meta name="description" content="%s" />' % meta['description'], head, flags=re.S)
    head = re.sub(r'<link rel="canonical" href="https://reprolegal\.com([^"]*)" />',
                  lambda m: '<link rel="canonical" href="https://reprolegal.com/%s%s" />' % (D, m.group(1)), head)
    head = re.sub(r'<meta property="og:url" content="https://reprolegal\.com([^"]*)" />',
                  lambda m: '<meta property="og:url" content="https://reprolegal.com/%s%s" />' % (D, m.group(1)), head)
    head = head.replace('<html lang="en">', '<html lang="%s">' % CODE)

    # ---- body ----
    for k in KEYS:
        v = T[k]
        if not v or v == k: continue
        # a text node may be split by inline tags, so tolerate surrounding whitespace
        body = re.sub(r'(>)(\s*)' + re.escape(k) + r'(\s*)(<)',
                      lambda m, v=v: m.group(1) + m.group(2) + v + m.group(3) + m.group(4), body)
        body = body.replace('placeholder="' + k + '"', 'placeholder="' + v + '"')
        body = body.replace('alt="' + k + '"', 'alt="' + v + '"')
    body = localise_links(body)
    body = switcher(body, url_path)

    if 'matcher.js' in body:
        # the matcher renders from JS, so it gets the whole dictionary
        body = body.replace('<script src="/assets/matcher.js" defer></script>',
                            '<script>window.MATCH_I18N=%s;</script>\n<script src="/assets/matcher.js" defer></script>'
                            % json.dumps(T, ensure_ascii=False))

    if EXPL and 'explorer.js' in body:
        body = body.replace('<script src="/assets/explorer.js" defer></script>',
                            '<script>window.EXPL_I18N=%s;</script>\n<script src="/assets/explorer.js" defer></script>'
                            % json.dumps(EXPL, ensure_ascii=False))

    os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
    open(out_path, 'w').write(head + '<body>' + body)
    count_pages += 1

missing = [k for k in T if not T[k]]
print('%s: %d pages built, %d strings in dictionary%s'
      % (D, count_pages, len(T), (', %d still empty' % len(missing)) if missing else ''))
