#!/usr/bin/env python3
"""Draws a share image for every article: 1200x630, in the site's own type and
   palette, and points the article's og:image at it.

       python3 scripts/make-og.py

   Idempotent. Needs Pillow:  pip install pillow
"""
import glob, os, re, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1200, 630
CREAM  = (247, 244, 239)
PAPER  = (255, 253, 250)
INK    = (39, 35, 32)
INK2   = (94, 88, 79)
INK3   = (145, 137, 128)
AMBER  = (181, 113, 60)
LINE   = (231, 226, 218)

JOST    = 'assets/fonts/Jost.ttf'
MANROPE = 'assets/fonts/Manrope.ttf'

def font(path, size, weight=None):
    f = ImageFont.truetype(path, size)
    if weight:
        try: f.set_variation_by_axes([weight])
        except Exception: pass
    return f

def track(d, xy, text, f, fill, spacing):
    """Draw letter-spaced text; returns the width used."""
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=f, fill=fill)
        x += d.textlength(ch, font=f) + spacing
    return x - xy[0]

def track_w(d, text, f, spacing):
    return sum(d.textlength(c, font=f) for c in text) + spacing * max(0, len(text) - 1)

def wrap(d, text, f, max_w):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=f) <= max_w:
            cur = t
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines

def arc_mark(d, cx, cy, r, ink, amber):
    d.arc([cx - r, cy - r, cx + r, cy + r], 180, 360, fill=ink, width=max(2, r // 13))
    r2 = int(r * 0.5)
    d.arc([cx - r2, cy - r2, cx + r2, cy + r2], 180, 360, fill=amber, width=max(3, r // 7))
    dot = max(2, r // 12)
    d.ellipse([cx - dot, cy - dot, cx + dot, cy + dot], fill=ink)

def render(title, category, human, out_path):
    im = Image.new('RGB', (W, H), CREAM)
    d = ImageDraw.Draw(im)

    # a soft warm wash in the lower right — drawn on its own layer and blurred,
    # so it reads as light rather than as concentric rings
    wash = Image.new('L', (W, H), 0)
    ImageDraw.Draw(wash).ellipse([W - 470, H - 330, W + 210, H + 210], fill=255)
    wash = wash.filter(ImageFilter.GaussianBlur(110))
    im.paste(Image.new('RGB', (W, H), PAPER), (0, 0), wash)
    d = ImageDraw.Draw(im)

    d.rectangle([0, 0, W, 6], fill=AMBER)

    arc_mark(d, 88, 104, 32, INK, AMBER)
    f_brand = font(JOST, 23, 300)
    track(d, (140, 80), 'REPROLEGAL', f_brand, INK, 5.8)
    f_sub = font(JOST, 12, 400)
    track(d, (140, 112), 'SURROGACY & DONATION', f_sub, INK3, 3.2)

    f_cat = font(JOST, 15, 400)
    if category:
        track(d, (88, 208), category.upper(), f_cat, AMBER, 4.2)

    f_title = font(JOST, 56, 300)
    lines = wrap(d, title, f_title, W - 300)[:4]
    y = 254
    for ln in lines:
        d.text((88, y), ln, font=f_title, fill=INK)
        y += 72

    y = max(y + 26, 470)
    d.line([(88, y), (208, y)], fill=LINE, width=1)

    f_meta = font(MANROPE, 21, 400)
    d.text((88, y + 28), human, font=f_meta, fill=INK2)
    right = 'reprolegal.com'
    d.text((W - 88 - d.textlength(right, font=f_meta), y + 28), right, font=f_meta, fill=INK3)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    im.save(out_path, 'PNG', optimize=True)

made = 0
for f in sorted(glob.glob('blog/*.html')):
    s = open(f, encoding='utf-8').read()
    slug = os.path.basename(f)[:-5]
    title = (re.search(r'<title>(.*?)\s*\|', s, re.S) or [None, slug])[1].strip()
    cat = re.search(r'· ([A-Za-z ]+)</div>\s*<h1>', s, re.S)
    date = re.search(r'class="views pubdate">·\s*([^<]+?)\s*(?:·|</span>)', s)
    out = 'img/og/%s.png' % slug
    render(title, cat.group(1).strip() if cat else 'Journal',
           date.group(1).strip() if date else '', out)

    # point the article at its own image
    s2 = re.sub(r'<meta property="og:image" content="[^"]*" />',
                '<meta property="og:image" content="https://reprolegal.com/%s" />' % out, s)
    if 'og:image:width' not in s2:
        s2 = s2.replace('<meta property="og:image"',
                        '<meta property="og:image:width" content="1200" />\n'
                        '<meta property="og:image:height" content="630" />\n'
                        '<meta property="og:image"', 1)
    if s2 != s: open(f, 'w', encoding='utf-8').write(s2)
    made += 1
    print('  %-58s → %s' % (os.path.basename(f)[:58], out))

print('\n%d share image(s) written' % made)
