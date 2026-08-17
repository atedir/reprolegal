#!/usr/bin/env python3
"""Rewrites the header, drawer and footer of every existing article so they match
   blog.html. Run once:  python3 scripts/fix-article-chrome.py"""
import glob, re

src = open('blog.html').read()
head   = src[src.index('<header'):src.index('</header>')+9]
drawer = src[src.index('<div class="drawer"'):src.index('</div>', src.index('</nav>'))+6]
foot   = src[src.index('<footer'):src.index('</footer>')+9]

n = 0
for f in glob.glob('blog/*.html'):
    s = open(f).read()
    o = s
    if '<header' in s:
        s = s[:s.index('<header')] + head + s[s.index('</header>')+9:]
    if '<div class="drawer"' in s:
        end = s.index('</div>', s.index('</nav>')) + 6
        s = s[:s.index('<div class="drawer"')] + drawer + s[end:]
    if '<footer' in s:
        s = s[:s.index('<footer')] + foot + s[s.index('</footer>')+9:]
    # GTM, favicon and manifest, if the article predates them
    if 'GTM-PKVPH96L' not in s:
        HEAD_END = '<!-- End Google Tag Manager -->'
        BODY_END = '<!-- End Google Tag Manager (noscript) -->'
        gtm_head = src[src.index('<!-- Google Tag Manager -->'):src.index(HEAD_END) + len(HEAD_END)]
        gtm_body = src[src.index('<!-- Google Tag Manager (noscript) -->'):src.index(BODY_END) + len(BODY_END)]
        s = s.replace('</head>', gtm_head + '\n</head>', 1).replace('<body>', '<body>\n' + gtm_body, 1)
    if 'favicon.svg' not in s:
        s = s.replace('<link rel="stylesheet" href="/assets/site.css" />',
                      '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />\n'
                      '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />\n'
                      '<link rel="manifest" href="/site.webmanifest" />\n'
                      '<link rel="stylesheet" href="/assets/site.css" />', 1)
    # repair the truncated GTM comment that swallowed the rest of the document
    s = s.replace('<!-- End Google Tag Manager (noscript) --\n', '<!-- End Google Tag Manager (noscript) -->\n')
    s = s.replace('<!-- End Google Tag Manager --\n', '<!-- End Google Tag Manager -->\n')

    # refuse to write a file whose comments are unbalanced
    if s.count('<!--') != s.count('-->'):
        print('  SKIPPED %s — unbalanced HTML comments, fix by hand' % f)
        continue

    if s != o:
        open(f, 'w').write(s); n += 1
        print('  fixed', f)
print('%d article(s) brought in line with the site' % n)
