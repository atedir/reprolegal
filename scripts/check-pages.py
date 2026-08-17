#!/usr/bin/env python3
"""Structural check across every HTML page. Run before a deploy:
       python3 scripts/check-pages.py
   Exits non-zero if anything is malformed, so it can go in CI."""
import glob, re, sys

pages = sorted(set(glob.glob('*.html') + glob.glob('*/*.html') + glob.glob('*/*/*.html')))
bad = 0
for f in pages:
    if f.startswith('node_modules'): continue
    s = open(f, encoding='utf-8').read()
    problems = []
    if s.count('<!--') != s.count('-->'):
        problems.append('unbalanced comments (%d open, %d closed)' % (s.count('<!--'), s.count('-->')))
    for tag in ['html', 'head', 'body', 'div', 'section', 'header', 'footer',
                'noscript', 'script', 'style', 'form', 'select', 'details', 'nav', 'p']:
        o = len(re.findall(r'<%s[\s>]' % tag, s))
        c = len(re.findall(r'</%s>' % tag, s))
        if o != c: problems.append('%s: %d open vs %d closed' % (tag, o, c))
    if not s.rstrip().endswith('</html>'):
        problems.append('does not end with </html>')
    if problems:
        bad += 1
        print('FAIL %s' % f)
        for p in problems: print('       %s' % p)

print('\n%d pages checked, %d with problems' % (len(pages), bad))
sys.exit(1 if bad else 0)
