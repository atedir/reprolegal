#!/usr/bin/env python3
"""Builds the journal listing in every language: <lang>/blog.html is page 1,
   <lang>/blog/page/N.html are the rest, PER cards each, newest first.
   The cards are drawn from the articles themselves (title, description, category,
   read time and date), so a new or translated article only has to exist to be listed.
   Safe to run repeatedly.
       python3 scripts/paginate-blog.py
"""
import glob, os, re, shutil
from sitelib import LANGS, SITE, i18n, tr

PER = 6
POSTS = re.compile(r'<!-- POSTS -->.*?<!-- /POSTS -->', re.S)
PAGER = re.compile(r'(<!-- PAGER -->).*?(<!-- /PAGER -->)', re.S)

def meta(s, pat):
    m = re.search(pat, s, re.S)
    return m.group(1).strip() if m else ''

def articles(folder):
    out = []
    for f in glob.glob(os.path.join(folder, 'blog', '*.html')):
        s = open(f, encoding='utf-8').read()
        out.append({
            'slug': os.path.basename(f)[:-5],
            'title': meta(s, r'<title>(.*?)\s*\|\s*ReproLegal</title>'),
            'description': meta(s, r'<meta name="description" content="([^"]*)"'),
            'category': meta(s, r'<div class="crumbs">.*? · ([^<·]+)</div>\s*<h1>'),
            'minutes': meta(s, r'<meta name="read-minutes" content="(\d+)"'),
            'date': meta(s, r'<span class="views pubdate">·\s*([^<]+)</span>'),
            'iso': meta(s, r'article:published_time" content="([^"]+)"'),
        })
    return sorted(out, key=lambda a: a['iso'], reverse=True)

def card(a, pre, T):
    english = a.get('english')                 # an untranslated article in a translated listing
    href = '/blog/%s' % a['slug'] if english else '%s/blog/%s' % (pre, a['slug'])
    category = tr(T, a['category']) if english else a['category']
    return ('      <a class="post reveal" href="%s"%s>\n'
            '        <div class="m">%s · %s %s · %s</div>\n'
            '        <h3>%s</h3>\n'
            '        <p>%s</p>\n'
            '        <span class="go">%s</span>\n'
            '        <span class="views" data-views="%s" style="margin-top:10px"></span>\n'
            '      </a>') % (href, ' hreflang="en"' if english else '', category, a['minutes'], tr(T, 'min'),
                             a['date'], a['title'], a['description'], tr(T, 'Read'), href)

def build(code, folder):
    T = i18n(code)
    T = {**T, **T.get('__blog__', {})}
    pre = '/' + folder if folder else ''
    index = os.path.join(folder, 'blog.html')
    if not os.path.exists(index):
        print('  %s: no blog.html, skipped' % (folder or 'en')); return
    base = open(index, encoding='utf-8').read()
    if '<!-- /POSTS -->' not in base or '<!-- PAGER -->' not in base:
        raise SystemExit('%s is missing the <!-- /POSTS --> or <!-- PAGER --> marker' % index)

    arts = articles(folder)
    if folder:
        # an article not translated yet is still listed, in English, until it is
        have = {x['slug'] for x in arts}
        arts = sorted(arts + [dict(x, english=True) for x in articles('') if x['slug'] not in have],
                      key=lambda x: x['iso'], reverse=True)
    cards = [card(a, pre, T) for a in arts]
    pages = [cards[i:i + PER] for i in range(0, len(cards), PER)] or [[]]
    total = len(pages)
    url = lambda n: '%s/blog' % pre if n == 1 else '%s/blog/page/%d' % (pre, n)

    def pager(n):
        if total == 1: return ''
        out = ['\n    <nav class="pager" aria-label="%s">' % tr(T, 'Journal pages')]
        if n > 1:
            out.append('      <a class="pg-step" href="%s" rel="prev">%s</a>' % (url(n - 1), tr(T, 'Newer')))
        for i in range(1, total + 1):
            out.append('      <span class="pg-num" aria-current="page">%d</span>' % i if i == n else
                       '      <a class="pg-num" href="%s">%d</a>' % (url(i), i))
        if n < total:
            out.append('      <a class="pg-step" href="%s" rel="next">%s</a>' % (url(n + 1), tr(T, 'Older')))
        return '\n'.join(out) + '\n    </nav>\n    '

    def fill(s, n):
        body = '\n\n'.join(pages[n - 1])
        s = POSTS.sub(lambda m: '<!-- POSTS -->\n' + body + ('\n' if body else '') + '<!-- /POSTS -->', s, count=1)
        s = PAGER.sub(lambda m: m.group(1) + pager(n) + m.group(2), s, count=1)
        home, journal = tr(T, 'Home'), tr(T, 'Journal')
        crumbs = ('<div class="crumbs"><a href="%s/">%s</a> · %s</div>' % (pre, home, journal) if n == 1 else
                  '<div class="crumbs"><a href="%s/">%s</a> · <a href="%s/blog">%s</a> · %s</div>'
                  % (pre, home, pre, journal, tr(T, 'Page {n}').replace('{n}', str(n))))
        return re.sub(r'<div class="crumbs">.*?</div>', lambda m: crumbs, s, count=1)

    def as_page(s, n):
        """Page n's head: its own title, description, canonical and URL."""
        title = tr(T, 'Journal — page {n}').replace('{n}', str(n)) + ' | ReproLegal'
        s = re.sub(r'<title>.*?</title>', '<title>%s</title>' % title, s, count=1)
        s = re.sub(r'(<meta property="og:title" content=")[^"]*', lambda m: m.group(1) + title, s, count=1)
        s = re.sub(r'(<meta name="description" content="[^"]*?)"', lambda m: '%s %s."' % (m.group(1).rstrip('.') + '.', tr(T, 'Page {n}').replace('{n}', str(n))), s, count=1)
        s = s.replace('<link rel="canonical" href="%s%s" />' % (SITE, url(1)),
                      '<link rel="canonical" href="%s%s" />' % (SITE, url(n)), 1)
        s = s.replace('<meta property="og:url" content="%s%s" />' % (SITE, url(1)),
                      '<meta property="og:url" content="%s%s" />' % (SITE, url(n)), 1)
        return s

    base = fill(base, 1)
    open(index, 'w', encoding='utf-8').write(base)

    pdir = os.path.join(folder, 'blog', 'page')
    os.makedirs(pdir, exist_ok=True)
    for n in range(2, total + 1):
        open(os.path.join(pdir, '%d.html' % n), 'w', encoding='utf-8').write(as_page(fill(base, n), n))
    for f in glob.glob(os.path.join(pdir, '*.html')):
        if int(os.path.basename(f)[:-5]) > total: os.remove(f)
    if not os.listdir(pdir): shutil.rmtree(pdir)
    print('  %-3s %d article(s) → %d page(s) of up to %d' % (folder or 'en', len(arts), total, PER))

for code, folder, *_ in LANGS:
    build(code, folder)
