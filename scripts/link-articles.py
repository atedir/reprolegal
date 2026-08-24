#!/usr/bin/env python3
"""Adds a 'Further reading' block to every article, linking two or three siblings.
   Idempotent — rewrites the block rather than stacking copies.
       python3 scripts/link-articles.py
"""
import glob, os, re

arts = []
for f in sorted(glob.glob('blog/*.html')):
    s = open(f, encoding='utf-8').read()
    m = re.search(r'<title>(.*?)\s*\|', s, re.S)
    iso = re.search(r'article:published_time" content="([^"]{10})', s)
    if m:
        arts.append({'file': f, 'slug': os.path.basename(f)[:-5],
                     'title': m.group(1).strip(), 'iso': iso.group(1) if iso else ''})

if len(arts) < 2:
    print('need at least two articles'); raise SystemExit

arts.sort(key=lambda a: a['iso'], reverse=True)

for a in arts:
    s = open(a['file'], encoding='utf-8').read()
    # drop any previous block first
    s = re.sub(r'\n?<h2>Further reading</h2>\s*<ul>.*?</ul>\n?', '\n', s, flags=re.S)

    siblings = [x for x in arts if x['slug'] != a['slug']][:3]
    block = '<h2>Further reading</h2>\n<ul>\n' + '\n'.join(
        '  <li><a href="/blog/%s">%s</a></li>' % (x['slug'], x['title']) for x in siblings) + '\n</ul>\n'

    # place it just before the closing disclaimer box
    anchor = '<div class="factbox"><div class="k">Not medical or legal advice</div>'
    if anchor in s:
        s = s.replace(anchor, block + anchor, 1)
    else:
        s = s.replace('</div></div></section>', block + '</div></div></section>', 1)
    open(a['file'], 'w', encoding='utf-8').write(s)
    print('  %-56s → %d links' % (os.path.basename(a['file'])[:56], len(siblings)))

print('\n%d articles cross-linked' % len(arts))
