#!/usr/bin/env python3
"""Adds a publication date to every article and to its card in blog.html.
   Run once after pulling this update:  python3 scripts/backfill-dates.py
   Safe to run repeatedly — it never duplicates a date."""
import re, glob, os, datetime

MONTHS = {1:'January',2:'February',3:'March',4:'April',5:'May',6:'June',7:'July',
          8:'August',9:'September',10:'October',11:'November',12:'December'}

dates = {}
for f in sorted(glob.glob('blog/*.html')):
    s = open(f).read()
    m = re.search(r'<meta property="article:published_time" content="([^"]+)"', s)
    if m:
        iso = m.group(1)[:10]
    else:
        iso = datetime.date.fromtimestamp(os.path.getmtime(f)).isoformat()
        s = s.replace('<meta property="og:type" content="article" />',
                      '<meta property="og:type" content="article" />\n'
                      '<meta property="article:published_time" content="%sT09:00:00.000Z" />' % iso, 1)
    d = datetime.date.fromisoformat(iso)
    human = '%d %s %d' % (d.day, MONTHS[d.month], d.year)
    dates['/blog/' + os.path.basename(f)[:-5]] = human

    # strip any date spans already present, then write exactly one
    s = re.sub(r'\s*<span class="views pubdate">[^<]*</span>', '', s)
    s = re.sub(r'(<span class="views" id="views">[^<]*</span>)',
               r'\1 <span class="views pubdate">· ' + human + '</span>', s, count=1)
    open(f, 'w').write(s)
    print('  %-58s %s' % (os.path.basename(f), human))

b = open('blog.html').read()
for slug, human in dates.items():
    pat = re.compile(r'(<a class="post reveal" href="' + re.escape(slug) + r'">.*?<div class="m">)([^<]*)(</div>)', re.S)
    def repl(m, human=human):
        if human in m.group(2): return m.group(0)
        return m.group(1) + m.group(2).strip() + ' · ' + human + m.group(3)
    b = pat.sub(repl, b)
open('blog.html', 'w').write(b)
print('\n%d articles dated, cards updated in blog.html' % len(dates))
