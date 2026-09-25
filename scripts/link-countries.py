#!/usr/bin/env python3
"""Adds a 'From the journal' block to every country page (English and translated),
   choosing articles by relevance to that destination:
   the country named in the headline counts most, then mentions in the body,
   then whether the article's audience (same-sex couples, single fathers) can use
   the destination at all. Articles that name no country are ranked by the words
   they share with the page's own facts (birth certificate, court step, exit…) and
   evergreen category, and spread out so neighbouring pages do not list the same three.
   Recency is the tie-breaker.
   Translated pages link to the article in their own language once it exists.
   Idempotent — rewrites the block between its markers instead of stacking copies.
       python3 scripts/link-countries.py
"""
import glob, json, os, re

PICK = 3
LANGS = {'en': '', 'uk': 'ua', 'de': 'de', 'fr': 'fr', 'es': 'es', 'it': 'it'}
# a destination article about somewhere else is noise; legal and checklist pieces apply everywhere
CAT_WEIGHT = {'Legal': 3, 'Due diligence': 2, 'Money': 2, 'Medical': 1, 'Destinations': -5}
ALIAS = {
    'united-states': r'\bUnited States\b|\bUSA?\b|\bU\.S\.|\bAmerican\b',
    'mexico':        r'(?<!New )\bMexico\b',
    'abu-dhabi':     r'\bAbu Dhabi\b|\bUAE\b|\bEmirates\b',
}
# who the article is written for → the 'allows' flag a destination needs to be useful to them
AUDIENCE = [(r'same-sex|gay|lgbt', 'samesex'), (r'single fathers?|single men', 'singlef'),
            (r'single mothers?|single women', 'singlem')]
START, END = '<!-- journal -->', '<!-- /journal -->'

STOP = set('''with from what which that this their there after before about into than have
when where more most other only also after birth [verify]'''.split())

def stems(s):
    return {w[:5] for w in re.findall(r'[a-z]{4,}', s.lower()) if w not in STOP}

def text(html):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', html))

arts = []
for f in sorted(glob.glob('blog/*.html')):
    s = open(f, encoding='utf-8').read()
    t = re.search(r'<title>(.*?)\s*\|', s, re.S)
    if not t: continue
    cat = re.search(r'· ([A-Za-z ]+)</div>\s*<h1>', s, re.S)
    iso = re.search(r'article:published_time" content="([^"]{10})', s)
    body = re.sub(r'<h2>Further reading</h2>\s*<ul>.*?</ul>', '', s, flags=re.S)
    body = body.split('<div class="prose">', 1)[-1]
    arts.append({'slug': os.path.basename(f)[:-5], 'title': t.group(1).strip(),
                 'cat': cat.group(1).strip() if cat else '', 'iso': iso.group(1) if iso else '',
                 'body': text(body), 'stems': stems(t.group(1))})

def score(d, a, used=None):
    pat = ALIAS.get(d['slug'], r'\b%s\b' % re.escape(d['n']))
    n = 30 if re.search(pat, a['title']) else 0
    mentions = len(re.findall(pat, a['body']))
    n += 2 * min(mentions, 8)
    for rx, flag in AUDIENCE:
        if re.search(rx, a['title'], re.I):
            n += 5 if flag in d['allows'] else -20
    if not mentions:
        page = stems(d['d'] + ' ' + ' '.join(v for _, v in d['facts']))
        n += CAT_WEIGHT.get(a['cat'], 0) + 2 * len(page & a['stems'])
        n -= 2 * (used or {}).get(a['slug'], 0)
    return n

def load_i18n(code):
    if code == 'en': return {}
    return json.load(open('content/i18n/%s.json' % code, encoding='utf-8'))

dests = json.load(open('content/destinations.json', encoding='utf-8'))
picks, used = {}, {}
for d in dests:
    ranked = sorted(arts, key=lambda a: (score(d, a, used), a['iso']), reverse=True)[:PICK]
    print('  %-14s → %s' % (d['slug'], ', '.join('%s(%d)' % (a['slug'][:26], score(d, a, used)) for a in ranked)))
    picks[d['slug']] = ranked
    for a in ranked:
        used[a['slug']] = used.get(a['slug'], 0) + 1

done = 0
for code, folder in LANGS.items():
    T = load_i18n(code)
    tr = lambda k: T.get(k, k)
    for d in dests:
        f = os.path.join(folder, 'countries', d['slug'] + '.html')
        if not os.path.exists(f): continue
        s = open(f, encoding='utf-8').read()
        s = re.sub(r'\n[ \t]*' + re.escape(START) + r'.*?' + re.escape(END), '', s, flags=re.S)
        items, english = [], False
        for a in picks[d['slug']]:
            local = os.path.join(folder, 'blog', a['slug'] + '.html')
            if folder and os.path.exists(local):
                title = re.search(r'<title>(.*?)\s*\|', open(local, encoding='utf-8').read(), re.S).group(1).strip()
                items.append('  <li><a href="/%s/blog/%s">%s</a></li>' % (folder, a['slug'], title))
            else:   # not translated yet: the English article, marked as such
                english = english or bool(folder)
                items.append('  <li><a href="/blog/%s"%s>%s</a></li>' % (a['slug'], ' hreflang="en"' if folder else '', a['title']))
        note = ['<p>%s</p>' % tr('Articles in English.')] if english else []
        block = [START, '<h2>%s</h2>' % tr('From the journal')] + note + ['<ul>'] + items + ['</ul>', END]
        m = re.search(r'\n([ \t]*)<h2>%s</h2>' % re.escape(tr('Other destinations')), s)
        if not m:
            print('  ! no "Other destinations" heading in %s, skipped' % f); continue
        ind = m.group(1)
        s = s[:m.start()] + ''.join('\n' + ind + line for line in block) + s[m.start():]
        open(f, 'w', encoding='utf-8').write(s)
        done += 1

print('\n%d country pages linked to the journal' % done)
