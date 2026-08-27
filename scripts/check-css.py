#!/usr/bin/env python3
"""Validates the stylesheet structurally: balanced comments and braces, and no
   stray text outside a rule — the failure that silently kills every rule after it.
       python3 scripts/check-css.py
"""
import re, sys

css = open('assets/site.css', encoding='utf-8').read()
problems = []

if css.count('/*') != css.count('*/'):
    problems.append('unbalanced comments: %d open, %d closed' % (css.count('/*'), css.count('*/')))
if css.count('{') != css.count('}'):
    problems.append('unbalanced braces: %d open, %d closed' % (css.count('{'), css.count('}')))

stripped = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
depth = 0
for i, line in enumerate(stripped.split('\n'), 1):
    t = line.strip()
    if not t:
        continue
    if depth == 0 and not re.match(r'^[@.#:*\[a-zA-Z}]', t):
        problems.append('line %d: text outside any rule → "%s"' % (i, t[:70]))
    depth += t.count('{') - t.count('}')
if depth != 0:
    problems.append('nesting does not close: depth %d at end of file' % depth)

for p in problems:
    print('FAIL', p)
print('%s — %d problem(s)' % ('assets/site.css', len(problems)))
sys.exit(1 if problems else 0)
