#!/usr/bin/env python3
"""Removes cards on the journal pages that point at articles which do not exist.
   Run after pulling, or any time the listing looks out of step:
       python3 scripts/prune-blog-cards.py
"""
import glob, os, re

have = {os.path.basename(f)[:-5] for f in glob.glob('blog/*.html')}
removed = []
def keep(m):
    slug = m.group(1)
    if slug in have:
        return m.group(0)
    removed.append(slug)
    return ''

remain = 0
for f in ['blog.html'] + glob.glob('blog/page/*.html'):
    b = open(f, encoding='utf-8').read()
    b2 = re.sub(r'\s*<a class="post reveal" href="/blog/([a-z0-9-]+)">.*?</a>\n?', keep, b, flags=re.S)
    if b2 != b:
        open(f, 'w', encoding='utf-8').write(b2)
    remain += b2.count('class="post reveal"')
for s in removed: print('  removed card →', s)
print('%d card(s) removed, %d remain — run paginate-blog.py to rebalance the pages' % (len(removed), remain))

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
