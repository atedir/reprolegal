// Shared by generate-post.mjs (writes the English article) and translate-posts.mjs
// (writes its copies in every other language), so an article looks the same in
// all six languages and the two scripts cannot drift apart.
import fs from 'node:fs/promises';
import path from 'node:path';

export const ROOT = process.cwd();
export const SITE = 'https://reprolegal.com';

// code, folder, language name (for the translation prompt), date locale
export const LANGS = [
  { code: 'en', dir: '',   name: 'English',   locale: 'en-GB' },
  { code: 'uk', dir: 'ua', name: 'Ukrainian', locale: 'uk-UA' },
  { code: 'de', dir: 'de', name: 'German',    locale: 'de-DE' },
  { code: 'fr', dir: 'fr', name: 'French',    locale: 'fr-FR' },
  { code: 'es', dir: 'es', name: 'Spanish',   locale: 'es-ES' },
  { code: 'it', dir: 'it', name: 'Italian',   locale: 'it-IT' },
];
export const lang = code => LANGS.find(l => l.code === code);
export const inDir = (l, rel) => path.join(ROOT, l.dir, rel);
export const urlPrefix = l => (l.dir ? '/' + l.dir : '');

// ---- dictionary -------------------------------------------------------------

const dicts = {};
export async function strings(code) {
  if (code === 'en') return {};
  if (!dicts[code]) {
    const all = JSON.parse(await fs.readFile(path.join(ROOT, 'content/i18n', code + '.json'), 'utf8'));
    dicts[code] = { ...all, ...(all.__blog__ || {}) };
  }
  return dicts[code];
}
export const t = (T, s) => (T && T[s]) || s;

// same day-month-year shape as scripts/sitelib.py human_date
const MONTHS = {
  en: 'January February March April May June July August September October November December',
  uk: 'січня лютого березня квітня травня червня липня серпня вересня жовтня листопада грудня',
  de: 'Januar Februar März April Mai Juni Juli August September Oktober November Dezember',
  fr: 'janvier février mars avril mai juin juillet août septembre octobre novembre décembre',
  es: 'enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre',
  it: 'gennaio febbraio marzo aprile maggio giugno luglio agosto settembre ottobre novembre dicembre',
};
export function humanDate(iso, code) {
  const [y, m, d] = [+iso.slice(0, 4), +iso.slice(5, 7), +iso.slice(8, 10)];
  const month = MONTHS[code].split(' ')[m - 1];
  if (code === 'de') return `${d}. ${month} ${y}`;
  if (code === 'es') return `${d} de ${month} de ${y}`;
  return `${d} ${month} ${y}`;
}

// ---- Claude -----------------------------------------------------------------

export async function claude({ model, system, user, maxTokens = 4000, thinking }) {
  const body = { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] };
  if (thinking) body.thinking = thinking;
  for (let attempt = 1; ; attempt++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });
    // rate limits and overloads clear up on their own; everything else is a real error
    if ((r.status === 429 || r.status >= 500) && attempt < 5) {
      await new Promise(res => setTimeout(res, 5000 * attempt));
      continue;
    }
    if (!r.ok) throw new Error('Anthropic ' + r.status + ' ' + (await r.text()));
    const d = await r.json();
    if (d.stop_reason === 'max_tokens') throw new Error('Anthropic: output hit max_tokens');
    if (d.stop_reason === 'refusal') throw new Error('Anthropic: request declined');
    return d.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  }
}

// ---- page chrome ------------------------------------------------------------

// The header, drawer and footer are lifted out of that language's journal page,
// so an article can never drift from the rest of the site.
export async function chrome(l) {
  const src = await fs.readFile(inDir(l, 'blog.html'), 'utf8');
  const head   = src.slice(src.indexOf('<header'), src.indexOf('</header>') + 9);
  const drawer = src.slice(src.indexOf('<div class="drawer"'), src.indexOf('</div>', src.indexOf('</nav>')) + 6);
  const foot   = src.slice(src.indexOf('<footer'), src.indexOf('</footer>') + 9);
  const HEAD_END = '<!-- End Google Tag Manager -->';
  const BODY_END = '<!-- End Google Tag Manager (noscript) -->';
  const gtmHead = src.slice(src.indexOf('<!-- Google Tag Manager -->'), src.indexOf(HEAD_END) + HEAD_END.length);
  const gtmBody = src.slice(src.indexOf('<!-- Google Tag Manager (noscript) -->'), src.indexOf(BODY_END) + BODY_END.length);
  return { head, drawer, foot, gtmHead, gtmBody };
}

export const esc = s => String(s).replace(/&(?!(amp|quot|lt|gt|#\d+);)/g, '&amp;')
  .replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function articleHtml({ code = 'en', title, description, lede, category, readMinutes,
                                   bodyHtml, slug, iso, ogImage, ch }) {
  const l = lang(code);
  const T = await strings(code);
  const pre = urlPrefix(l);
  const url = `${SITE}${pre}/blog/${slug}`;
  const human = humanDate(iso, code);
  const og = ogImage
    ? `<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />\n<meta property="og:image" content="${ogImage}" />`
    : `<meta property="og:image" content="${SITE}/img/og.png" />`;
  return `<!DOCTYPE html>
<html lang="${code}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} | ReproLegal</title>
<meta name="description" content="${description}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="article" />
<meta property="article:published_time" content="${iso}" />
<meta name="read-minutes" content="${readMinutes}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
${og}
<meta property="og:url" content="${url}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="theme-color" content="#272320" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Jost:wght@200;300;400;500&family=Manrope:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css" />
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Article","headline":${JSON.stringify(title)},
"description":${JSON.stringify(description)},"inLanguage":"${code}","datePublished":"${iso}","dateModified":"${iso}",
"author":{"@type":"Organization","name":"ReproLegal"},"publisher":{"@type":"Organization","name":"ReproLegal"},
"mainEntityOfPage":"${url}"}
</script>
${ch.gtmHead}
</head>
<body>
${ch.gtmBody}
${ch.head}
${ch.drawer}
<div class="pagehead"><div class="wrap">
  <div class="crumbs"><a href="${pre}/">${t(T, 'Home')}</a> · <a href="${pre}/blog">${t(T, 'Journal')}</a> · ${t(T, category)}</div>
  <h1>${title}</h1>
  <p>${lede || description}</p>
  <div style="margin-top:20px">
    <span class="views" id="views">—</span> <span class="views pubdate">· ${human}</span>
  </div>
</div></div>
<section style="padding:80px 0"><div class="wrap"><div class="prose">
${bodyHtml}
<div class="factbox"><div class="k">${t(T, 'Not medical or legal advice')}</div>${t(T, 'This article describes how programmes are structured. Eligibility and recognition depend on your country of residence — confirm your route with local counsel.')}</div>
</div></div></section>
${ch.foot}
<script src="/assets/site.js" defer></script>
</body>
</html>
`;
}

// ---- reading an existing article --------------------------------------------

// the closing disclaimer; older hand-written articles phrase it as "Not legal advice"
const STANDARD_FACTBOX = /\s*<div class="factbox"><div class="k">Not (?:medical or )?legal advice<\/div>[\s\S]*?<\/div>\s*$/;

/** Inner HTML of the first <div class="prose">, found by counting nested divs. */
function proseInner(s) {
  const start = s.indexOf('<div class="prose">');
  if (start < 0) return '';
  const from = start + '<div class="prose">'.length;
  const re = /<div[\s>]|<\/div>/g;
  re.lastIndex = from;
  let depth = 1, m;
  while ((m = re.exec(s))) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) return s.slice(from, m.index);
  }
  return s.slice(from);
}

export function readArticle(html) {
  const pick = re => (html.match(re) || [])[1];
  const unesc = s => s && s.trim();
  // the sibling list is rebuilt per language by link-articles.py, and the disclaimer by the template
  let body = proseInner(html)
    .replace(/\n?<h2>Further reading<\/h2>\s*<ul>[\s\S]*?<\/ul>\n?/, '\n')
    .replace(STANDARD_FACTBOX, '')
    .trim();
  return {
    title: unesc(pick(/<title>([\s\S]*?)\s*\|\s*ReproLegal<\/title>/)),
    description: unesc(pick(/<meta name="description" content="([^"]*)"/)),
    lede: unesc(pick(/<h1>[\s\S]*?<\/h1>\s*<p>([\s\S]*?)<\/p>/)),
    category: unesc(pick(/· ([A-Za-z ]+)<\/div>\s*<h1>/)),
    iso: pick(/article:published_time" content="([^"]+)"/),
    readMinutes: parseInt(pick(/<meta name="read-minutes" content="(\d+)"/) || '0', 10) || null,
    ogImage: pick(/<meta property="og:image" content="([^"]+)"/),
    body,
  };
}

// ---- links ------------------------------------------------------------------

/** Internal links point at the same language. The journal only when that article exists there. */
export async function localiseLinks(html, l) {
  if (!l.dir) return html;
  const exists = async p => fs.access(p).then(() => true, () => false);
  const out = [];
  let last = 0;
  for (const m of html.matchAll(/href="(\/[^"]*)"/g)) {
    const href = m[1];
    let to = href;
    const art = href.match(/^\/blog\/([a-z0-9-]+)$/);
    if (art) {
      if (await exists(inDir(l, `blog/${art[1]}.html`))) to = `/${l.dir}${href}`;
    } else if (!/^\/(assets|img|favicon|ua\/|de\/|fr\/|es\/|it\/)/.test(href)) {
      to = href === '/' ? `/${l.dir}/` : `/${l.dir}${href}`;
    }
    out.push(html.slice(last, m.index), `href="${to}"`);
    last = m.index + m[0].length;
  }
  out.push(html.slice(last));
  return out.join('');
}
