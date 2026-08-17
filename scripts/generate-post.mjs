#!/usr/bin/env node
/**
 * Generates one SEO article every run and commits it.
 *   node scripts/generate-post.mjs
 * Requires: ANTHROPIC_API_KEY
 * Queue: content/topics.txt (one topic per line). When empty, Claude proposes the next topic.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const MODEL = 'claude-sonnet-4-6';
const TOPICS = path.join(ROOT, 'content/topics.txt');
const BLOG_INDEX = path.join(ROOT, 'blog.html');
const SITEMAP = path.join(ROOT, 'sitemap.xml');
const SITE = 'https://reprolegal.com';

// The header, drawer and footer are lifted straight out of blog.html, so an
// article can never drift from the rest of the site.
async function chrome() {
  const src = await fs.readFile(BLOG_INDEX, 'utf8');
  const head   = src.slice(src.indexOf('<header'), src.indexOf('</header>') + 9);
  const drawer = src.slice(src.indexOf('<div class="drawer"'), src.indexOf('</div>', src.indexOf('</nav>')) + 6);
  const foot   = src.slice(src.indexOf('<footer'), src.indexOf('</footer>') + 9);
  const HEAD_END = '<!-- End Google Tag Manager -->';
  const BODY_END = '<!-- End Google Tag Manager (noscript) -->';
  const gtmHead = src.slice(src.indexOf('<!-- Google Tag Manager -->'),
                            src.indexOf(HEAD_END) + HEAD_END.length);
  const gtmBody = src.slice(src.indexOf('<!-- Google Tag Manager (noscript) -->'),
                            src.indexOf(BODY_END) + BODY_END.length);
  return { head, drawer, foot, gtmHead, gtmBody };
}

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);

async function claude(system, user, maxTokens = 4000) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] })
  });
  if (!r.ok) throw new Error('Anthropic ' + r.status + ' ' + (await r.text()));
  const d = await r.json();
  return d.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}

const SYSTEM = `You write for ReproLegal, an agency coordinating surrogacy and IVF programmes for intended parents.
Voice: precise, calm, factual. British spelling. No hype, no emoji, no exclamation marks.
Hard rules:
- Never promise or imply a guaranteed clinical outcome.
- Never state a legal position as settled fact; write "as of writing" and advise confirming with local counsel.
- Never invent statistics, prices, clinic names or case studies. If a figure is needed, give a range and label it typical.
- This is not medical or legal advice and must say so once, at the end.
Return the article in exactly this format, with nothing before or after.
Do not use markdown fences. Do not use JSON.

<<<TITLE>>>
the headline, max 70 characters
<<<DESCRIPTION>>>
meta description, max 155 characters, one line
<<<CATEGORY>>>
one of: Legal, Money, Medical, Due diligence, Destinations
<<<READMINUTES>>>
a single integer
<<<BODY>>>
the article body as HTML using only h2, h3, p, ul, ol, li, blockquote and a tags.
900-1400 words. Include 2-3 internal links chosen from /countries /costs /how-it-works /programmes /faq.
<<<END>>>`;

async function nextTopic() {
  let raw = '';
  try { raw = await fs.readFile(TOPICS, 'utf8'); } catch {}
  const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
  if (lines.length) {
    const topic = lines.shift();
    await fs.writeFile(TOPICS, lines.join('\n') + (lines.length ? '\n' : ''));
    return topic;
  }
  const existing = (await fs.readdir(path.join(ROOT, 'blog')).catch(() => [])).join(', ');
  return await claude(SYSTEM.split('Return ONLY')[0],
    `Propose ONE new article topic for this site that is not already covered. Existing files: ${existing}. Reply with the topic only, no punctuation at the end.`, 200);
}

function articleHtml({ title, description, category, readMinutes, bodyHtml, slug, iso, human, ch }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} | ReproLegal</title>
<meta name="description" content="${description}" />
<link rel="canonical" href="${SITE}/blog/${slug}" />
<meta property="og:type" content="article" />
<meta property="article:published_time" content="${iso}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${SITE}/img/og.png" />
<meta property="og:url" content="${SITE}/blog/${slug}" />
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
"description":${JSON.stringify(description)},"datePublished":"${iso}","dateModified":"${iso}",
"author":{"@type":"Organization","name":"ReproLegal"},"publisher":{"@type":"Organization","name":"ReproLegal"},
"mainEntityOfPage":"${SITE}/blog/${slug}"}
</script>
${ch.gtmHead}
</head>
<body>
${ch.gtmBody}
${ch.head}
${ch.drawer}
<div class="pagehead"><div class="wrap">
  <div class="crumbs"><a href="/">Home</a> · <a href="/blog">Journal</a> · ${category}</div>
  <h1>${title}</h1>
  <p>${description}</p>
  <div style="margin-top:20px">
    <span class="views" id="views">—</span>
    <span class="views pubdate">· ${human} · ${readMinutes} min</span>
  </div>
</div></div>
<section style="padding:80px 0"><div class="wrap"><div class="prose">
${bodyHtml}
<div class="factbox"><div class="k">Not medical or legal advice</div>This article describes how programmes are structured. Eligibility and recognition depend on your country of residence — confirm your route with local counsel.</div>
</div></div></section>
${ch.foot}
<script src="/assets/site.js" defer></script>
</body>
</html>
`;
}

const card = ({ slug, category, readMinutes, title, description, human }) => `      <a class="post reveal" href="/blog/${slug}">
        <div class="m">${category} · ${readMinutes} min · ${human}</div>
        <h3>${title}</h3>
        <p>${description}</p>
        <span class="go">Read</span>
        <span class="views" data-views="/blog/${slug}" style="margin-top:10px"></span>
      </a>
`;

const run = async () => {
  const topic = await nextTopic();
  console.log('Topic:', topic);

  const raw = await claude(SYSTEM, `Write the article. Topic: ${topic}`);

  const field = (name, next) => {
    const re = new RegExp('<<<' + name + '>>>([\\s\\S]*?)<<<' + next + '>>>');
    const m = raw.match(re);
    if (!m) throw new Error('Model output missing section ' + name + '. Raw start:\n' + raw.slice(0, 400));
    return m[1].trim();
  };

  const post = {
    title:       field('TITLE', 'DESCRIPTION'),
    description: field('DESCRIPTION', 'CATEGORY').replace(/\s+/g, ' '),
    category:    field('CATEGORY', 'READMINUTES'),
    readMinutes: parseInt(field('READMINUTES', 'BODY'), 10) || 7,
    bodyHtml:    field('BODY', 'END')
  };

  // quotes in title/description would break the HTML attributes they land in
  const esc = t => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  post.title = esc(post.title);
  post.description = esc(post.description);

  const slug = slugify(post.title);
  const now = new Date();
  const iso = now.toISOString();
  const human = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  await fs.mkdir(path.join(ROOT, 'blog'), { recursive: true });
  const ch = await chrome();
  const html = articleHtml({ ...post, slug, iso, human, ch });

  // Sanity checks. A malformed article is worse than no article: an unclosed
  // comment or tag swallows the whole document and the page renders blank.
  const problems = [];
  if ((html.match(/<!--/g) || []).length !== (html.match(/-->/g) || []).length)
    problems.push('unbalanced HTML comments');
  for (const tag of ['div', 'section', 'noscript', 'script', 'header', 'footer', 'p']) {
    const open = (html.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length;
    const close = (html.match(new RegExp('</' + tag + '>', 'g')) || []).length;
    if (open !== close) problems.push(`${tag}: ${open} open vs ${close} closed`);
  }
  if (!html.trimEnd().endsWith('</html>')) problems.push('document does not end with </html>');
  if (problems.length) {
    console.error('Refusing to write a malformed article:\n  ' + problems.join('\n  '));
    process.exit(1);
  }

  await fs.writeFile(path.join(ROOT, 'blog', slug + '.html'), html);

  // newest card first, right after the marker
  const idx = await fs.readFile(BLOG_INDEX, 'utf8');
  await fs.writeFile(BLOG_INDEX, idx.replace('<!-- POSTS -->', '<!-- POSTS -->\n' + card({ ...post, slug, human })));

  // sitemap entry
  const sm = await fs.readFile(SITEMAP, 'utf8');
  const entry = `  <url><loc>${SITE}/blog/${slug}</loc><lastmod>${iso.slice(0, 10)}</lastmod><priority>0.6</priority></url>`;
  if (!sm.includes(`/blog/${slug}<`)) {
    await fs.writeFile(SITEMAP, sm.replace('</urlset>', entry + '\n</urlset>'));
  }

  console.log('Wrote blog/' + slug + '.html');
};

run().catch(e => { console.error(e); process.exit(1); });
