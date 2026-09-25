#!/usr/bin/env python3
"""Adds a 'Further reading' block to every article, choosing siblings by relevance:
   same category first, then headline words in common, then recency as tie-breaker.
   The choice is made once, on the English articles, and every translation gets the
   same siblings in its own language, linked within that language.
   Idempotent — rewrites the block instead of stacking copies.
       python3 scripts/link-articles.py
"""
import glob, os, re
from sitelib import LANGS, i18n, tr

STOP = set("""a an the and or of for to in on at by with from what which who whom how why is are was
were be been do does did your you we our it its that this these those not no as about before after
when where explained country countries surrogacy reprolegal""".split())

def words(s):
    return {w for w in re.findall(r'[a-z]{4,}', s.lower()) if w not in STOP}

arts = []
for f in sorted(glob.glob('blog/*.html')):
    s = open(f, encoding='utf-8').read()
    t = re.search(r'<title>(.*?)\s*\|', s, re.S)
    cat = re.search(r'· ([A-Za-z ]+)</div>\s*<h1>', s, re.S)
    iso = re.search(r'article:published_time" content="([^"]{10})', s)
    if t:
        arts.append({'file': f, 'slug': os.path.basename(f)[:-5], 'title': t.group(1).strip(),
                     'cat': cat.group(1).strip() if cat else '', 'iso': iso.group(1) if iso else '',
                     'words': words(t.group(1))})

if len(arts) < 2:
    print('need at least two articles'); raise SystemExit

for a in arts:
    scored = []
    for b in arts:
        if b['slug'] == a['slug']: continue
        score = (10 if b['cat'] and b['cat'] == a['cat'] else 0) + 3 * len(a['words'] & b['words'])
        scored.append((score, b['iso'], b))
    scored.sort(key=lambda x: (-x[0], x[1] < ''), reverse=False)
    scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
    picked = [b for _, _, b in scored[:3]]

    for code, folder, *_ in LANGS:
        T = i18n(code); T = {**T, **T.get('__blog__', {})}
        f = os.path.join(folder, 'blog', a['slug'] + '.html')
        if not os.path.exists(f): continue
        pre = '/' + folder if folder else ''
        heading = tr(T, 'Further reading')
        items = []
        for b in picked:
            bf = os.path.join(folder, 'blog', b['slug'] + '.html')
            if not os.path.exists(bf): continue
            title = re.search(r'<title>(.*?)\s*\|', open(bf, encoding='utf-8').read(), re.S).group(1).strip()
            items.append('  <li><a href="%s/blog/%s">%s</a></li>' % (pre, b['slug'], title))
        s = open(f, encoding='utf-8').read()
        s = re.sub(r'\n?<h2>%s</h2>\s*<ul>.*?</ul>\n?' % re.escape(heading), '\n', s, flags=re.S)
        if items:
            block = '<h2>%s</h2>\n<ul>\n' % heading + '\n'.join(items) + '\n</ul>\n'
            anchor = '<div class="factbox"><div class="k">%s</div>' % tr(T, 'Not medical or legal advice')
            s = s.replace(anchor, block + anchor, 1) if anchor in s else \
                s.replace('</div></div></section>', block + '</div></div></section>', 1)
        open(f, 'w', encoding='utf-8').write(s)
    print('  %-50s → %s' % (a['slug'][:50], ', '.join('%s(%s)' % (b['slug'][:22], b['cat'][:4]) for b in picked)))

print('\n%d articles cross-linked by relevance' % len(arts))
