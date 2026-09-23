#!/usr/bin/env python3
"""Splits the journal listing into pages of PER cards.
   blog.html is page 1, blog/page/N.html are the rest. Cards are gathered from every
   page in order (newest first), so a card added to the top of blog.html pushes the
   oldest ones onto the next page. Safe to run repeatedly.
       python3 scripts/paginate-blog.py
"""
import glob, os, re

PER = 6
SITE = 'https://reprolegal.com'
CARD = re.compile(r'[ \t]*<a class="post reveal" href="(/blog/[a-z0-9-]+)">.*?</a>', re.S)
POSTS = re.compile(r'<!-- POSTS -->.*?<!-- /POSTS -->', re.S)
PAGER = re.compile(r'(<!-- PAGER -->).*?(<!-- /PAGER -->)', re.S)

def url(n):
    return '/blog' if n == 1 else '/blog/page/%d' % n

def page_files():
    found = glob.glob('blog/page/*.html')
    return sorted(found, key=lambda f: int(os.path.basename(f)[:-5]))

base = open('blog.html', encoding='utf-8').read()
if '<!-- /POSTS -->' not in base or '<!-- PAGER -->' not in base:
    raise SystemExit('blog.html is missing the <!-- /POSTS --> or <!-- PAGER --> marker')

# every card, in listing order, first occurrence wins
cards, seen = [], set()
for f in ['blog.html'] + page_files():
    s = open(f, encoding='utf-8').read()
    m = POSTS.search(s)
    for c in CARD.finditer(m.group(0) if m else ''):
        if c.group(1) not in seen:
            seen.add(c.group(1))
            cards.append(c.group(0).strip('\n'))

pages = [cards[i:i + PER] for i in range(0, len(cards), PER)] or [[]]
total = len(pages)

def pager(n):
    if total == 1:
        return ''
    out = ['\n    <nav class="pager" aria-label="Journal pages">']
    if n > 1:
        out.append('      <a class="pg-step" href="%s" rel="prev">Newer</a>' % url(n - 1))
    for i in range(1, total + 1):
        out.append('      <span class="pg-num" aria-current="page">%d</span>' % i if i == n else
                   '      <a class="pg-num" href="%s">%d</a>' % (url(i), i))
    if n < total:
        out.append('      <a class="pg-step" href="%s" rel="next">Older</a>' % url(n + 1))
    return '\n'.join(out) + '\n    </nav>\n    '

def fill(s, n):
    body = '\n\n'.join(pages[n - 1])
    s = POSTS.sub(lambda m: '<!-- POSTS -->\n' + body + ('\n' if body else '') + '<!-- /POSTS -->', s, count=1)
    return PAGER.sub(lambda m: m.group(1) + pager(n) + m.group(2), s, count=1)

def as_page(s, n):
    """Page n's head: its own title, canonical and URL, and no hreflang (the pages are English only)."""
    title = 'Journal — page %d | ReproLegal' % n
    s = re.sub(r'<title>.*?</title>', '<title>%s</title>' % title, s, count=1)
    s = re.sub(r'(<meta property="og:title" content=")[^"]*', r'\g<1>' + title, s, count=1)
    s = re.sub(r'(<meta name="description" content="[^"]*?)"', r'\1 Page %d."' % n, s, count=1)
    s = re.sub(r'\n<link rel="alternate" hreflang="[^"]*" href="[^"]*" />', '', s)
    s = s.replace('<link rel="canonical" href="%s/blog" />' % SITE,
                  '<link rel="canonical" href="%s%s" />' % (SITE, url(n)), 1)
    s = s.replace('<meta property="og:url" content="%s/blog" />' % SITE,
                  '<meta property="og:url" content="%s%s" />' % (SITE, url(n)), 1)
    s = s.replace('<div class="crumbs"><a href="/">Home</a> · Journal</div>',
                  '<div class="crumbs"><a href="/">Home</a> · <a href="/blog">Journal</a> · Page %d</div>' % n, 1)
    return s

base = fill(base, 1)
open('blog.html', 'w', encoding='utf-8').write(base)

os.makedirs('blog/page', exist_ok=True)
for n in range(2, total + 1):
    open('blog/page/%d.html' % n, 'w', encoding='utf-8').write(as_page(fill(base, n), n))
for f in page_files():
    if int(os.path.basename(f)[:-5]) > total:
        os.remove(f)
if not os.listdir('blog/page'):
    os.rmdir('blog/page')

# sitemap: one entry per extra page, rewritten each run
sm = open('sitemap.xml', encoding='utf-8').read()
sm = re.sub(r'  <url><loc>%s/blog/page/\d+</loc>.*?</url>\n' % re.escape(SITE), '', sm)
extra = ''.join('  <url><loc>%s%s</loc><priority>0.3</priority></url>\n' % (SITE, url(n))
                for n in range(2, total + 1))
open('sitemap.xml', 'w', encoding='utf-8').write(sm.replace('</urlset>', extra + '</urlset>'))

print('%d cards → %d page(s) of up to %d' % (len(cards), total, PER))
