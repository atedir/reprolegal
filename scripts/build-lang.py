#!/usr/bin/env python3
"""Builds a full translated copy of index.html for one language.
   Usage: python3 scripts/build-lang.py it
   Translations live in content/i18n/<code>.json as {"english string": "translation"}."""
import re, json, sys, os

CODE = sys.argv[1]
LANGS = [('en','English','/'),('uk','Українська','/ua/'),('de','Deutsch','/de/'),
         ('fr','Français','/fr/'),('es','Español','/es/'),('it','Italiano','/it/')]
LABEL = {'en':'EN','uk':'UA','de':'DE','fr':'FR','es':'ES','it':'IT'}
DIR   = {'uk':'ua','de':'de','fr':'fr','es':'es','it':'it'}

T = json.load(open('content/i18n/%s.json' % CODE))
META = T.pop('__meta__')
EXPL = T.pop('__explorer__', {})

s = open('index.html').read()
head, body = s.split('<body>', 1)

# --- head -----------------------------------------------------------------
head = re.sub(r'<title>.*?</title>', '<title>%s</title>' % META['title'], head, flags=re.S)
head = re.sub(r'<meta name="description" content=".*?" />',
              '<meta name="description" content="%s" />' % META['description'], head, flags=re.S)
head = re.sub(r'<link rel="canonical" href=".*?" />',
              '<link rel="canonical" href="https://reprolegal.com/%s/" />' % DIR[CODE], head)
head = re.sub(r'<meta property="og:url" content=".*?" />',
              '<meta property="og:url" content="https://reprolegal.com/%s/" />' % DIR[CODE], head)
head = re.sub(r'<meta property="og:title" content=".*?" />',
              '<meta property="og:title" content="%s" />' % META['title'], head, flags=re.S)
head = head.replace('<html lang="en">', '<html lang="%s">' % CODE)

# --- body: replace text nodes, longest first so short keys never eat long ones
for k in sorted(T, key=len, reverse=True):
    v = T[k]
    if not v or v == k: continue
    body = body.replace('>' + k + '<', '>' + v + '<')
    body = body.replace('placeholder="' + k + '"', 'placeholder="' + v + '"')
    body = body.replace('aria-label="' + k + '"', 'aria-label="' + v + '"')

# --- language switcher ----------------------------------------------------
body = re.sub(r'<summary aria-label="[^"]*">[^<]*</summary>',
              '<summary aria-label="Language">%s</summary>' % LABEL[CODE], body, count=1)
body = re.sub(r'<div class="langmenu">.*?</div>',
              '<div class="langmenu">' + ''.join(
                  '<a href="%s"%s>%s</a>' % (u, ' class="on"' if c == CODE else '', n)
                  for c, n, u in LANGS) + '</div>', body, flags=re.S, count=1)

# --- explorer labels ------------------------------------------------------
if EXPL:
    body = body.replace('<script src="/assets/explorer.js" defer></script>',
                        '<script>window.EXPL_I18N=%s;</script>\n<script src="/assets/explorer.js" defer></script>'
                        % json.dumps(EXPL, ensure_ascii=False))

# --- links that must stay on the English pages get a note, the rest resolve as-is
os.makedirs(DIR[CODE], exist_ok=True)
open(DIR[CODE] + '/index.html', 'w').write(head + '<body>' + body)
print('wrote %s/index.html  (%d strings applied)' % (DIR[CODE], len(T)))
