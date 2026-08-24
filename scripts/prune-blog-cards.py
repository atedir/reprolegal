#!/usr/bin/env python3
"""Removes cards in blog.html that point at articles which do not exist.
   Run after pulling, or any time the listing looks out of step:
       python3 scripts/prune-blog-cards.py
"""
import glob, os, re

have = {os.path.basename(f)[:-5] for f in glob.glob('blog/*.html')}
b = open('blog.html', encoding='utf-8').read()

removed = []
def keep(m):
    slug = m.group(1)
    if slug in have:
        return m.group(0)
    removed.append(slug)
    return ''

b2 = re.sub(r'\s*<a class="post reveal" href="/blog/([a-z0-9-]+)">.*?</a>\n?', keep, b, flags=re.S)

if removed:
    open('blog.html', 'w', encoding='utf-8').write(b2)
    for s in removed: print('  removed card →', s)
print('%d card(s) removed, %d remain' % (len(removed), b2.count('class="post reveal"')))

# the same links may sit in Further reading blocks inside articles
fixed = 0
for f in glob.glob('blog/*.html'):
    s = open(f, encoding='utf-8').read(); o = s
    for slug in re.findall(r'href="/blog/([a-z0-9-]+)"', s):
        if slug not in have:
            s = re.sub(r'\s*<li><a href="/blog/%s">.*?</li>' % re.escape(slug), '', s, flags=re.S)
    # drop the block entirely if it ended up empty
    s = re.sub(r'\n?<h2>Further reading</h2>\s*<ul>\s*</ul>\n?', '\n', s)
    if s != o:
        open(f, 'w', encoding='utf-8').write(s); fixed += 1
print('%d article(s) cleaned of dead links' % fixed)
