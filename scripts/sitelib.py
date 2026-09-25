"""Shared facts about the site's languages, for the build scripts.

English lives at the root; every other language mirrors the same file tree
under its own folder (ua/costs.html, de/blog/<slug>.html ...). A page's
translations are therefore the same relative path under each folder.
"""
import json, os

# (hreflang code, folder, name in its own language, switcher label, date locale)
LANGS = [('en', '',   'English',    'EN', 'en-GB'),
         ('uk', 'ua', 'Українська', 'UA', 'uk-UA'),
         ('de', 'de', 'Deutsch',    'DE', 'de-DE'),
         ('fr', 'fr', 'Français',   'FR', 'fr-FR'),
         ('es', 'es', 'Español',    'ES', 'es-ES'),
         ('it', 'it', 'Italiano',   'IT', 'it-IT')]
FOLDER = {c: d for c, d, *_ in LANGS}
SITE = 'https://reprolegal.com'

MONTHS = {
    'en': 'January February March April May June July August September October November December',
    'uk': 'січня лютого березня квітня травня червня липня серпня вересня жовтня листопада грудня',
    'de': 'Januar Februar März April Mai Juni Juli August September Oktober November Dezember',
    'fr': 'janvier février mars avril mai juin juillet août septembre octobre novembre décembre',
    'es': 'enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre',
    'it': 'gennaio febbraio marzo aprile maggio giugno luglio agosto settembre ottobre novembre dicembre',
}

def human_date(iso, code):
    """'2026-09-22' → '22 September 2026' / '22 вересня 2026' / '22. September 2026' ..."""
    y, m, d = int(iso[:4]), int(iso[5:7]), int(iso[8:10])
    month = MONTHS[code].split()[m - 1]
    if code == 'de': return '%d. %s %d' % (d, month, y)
    if code in ('es',): return '%d de %s de %d' % (d, month, y)
    return '%d %s %d' % (d, month, y)

def i18n(code):
    """The UI dictionary for a language; English maps every string to itself."""
    if code == 'en': return {}
    return json.load(open('content/i18n/%s.json' % code, encoding='utf-8'))

def tr(T, s):
    return T.get(s) or s

def rel(f):
    """Path of a page relative to its language folder: 'ua/blog/x.html' → 'blog/x.html'."""
    parts = f.split('/', 1)
    return parts[1] if parts[0] in FOLDER.values() and parts[0] and len(parts) > 1 else f

def lang_of(f):
    first = f.split('/', 1)[0]
    for c, d, *_ in LANGS:
        if d and first == d: return c
    return 'en'

def file_in(code, relpath):
    return os.path.join(FOLDER[code], relpath) if FOLDER[code] else relpath

def url_of(code, relpath):
    """Public path for a page: index.html → '/', blog/page/2.html → '/blog/page/2'."""
    p = relpath[:-5] if relpath.endswith('.html') else relpath
    if p == 'index': p = ''
    elif p.endswith('/index'): p = p[:-6]
    d = FOLDER[code]
    if not d: return '/' + p
    return '/%s/%s' % (d, p) if p else '/%s/' % d

def translations(relpath):
    """{code: public path} for every language in which this page exists."""
    return {c: url_of(c, relpath) for c, *_ in LANGS if os.path.exists(file_in(c, relpath))}
