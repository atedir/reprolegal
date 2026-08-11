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
Return ONLY a JSON object, no markdown fence, with keys:
title (max 70 chars), description (max 155 chars), category (one of: Legal, Money, Medical, Due diligence, Destinations),
readMinutes (integer), bodyHtml (h2/h3/p/ul/ol/li/blockquote/a only; 900-1400 words; include 2-3 internal links
chosen from /countries /costs /how-it-works /programmes /faq).`;

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

function articleHtml({ title, description, category, readMinutes, bodyHtml, slug, iso, human }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} | ReproLegal</title>
<meta name="description" content="${description}" />
<link rel="canonical" href="${SITE}/blog/${slug}" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${SITE}/blog/${slug}" />
<meta property="article:published_time" content="${iso}" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Jost:wght@200;300;400;500&family=Manrope:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css" />
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Article","headline":${JSON.stringify(title)},
"description":${JSON.stringify(description)},"datePublished":"${iso}","dateModified":"${iso}",
"author":{"@type":"Organization","name":"ReproLegal"},"publisher":{"@type":"Organization","name":"ReproLegal"},
"mainEntityOfPage":"${SITE}/blog/${slug}"}
</script>
</head>
<body>
<header id="hdr" class="solid">
  <div class="wrap nav">
    <button class="burger" id="burger" aria-label="Menu"><span></span><span></span><span></span></button>
    <a href="/" class="brand">ReproLegal<small>Surrogacy &amp; Donation</small></a>
    <div class="navr"><a href="/countries" class="hide-s">Countries</a><a href="/costs" class="hide-s">Costs</a><a href="/#contact">Start your journey</a></div>
  </div>
</header>
<div class="drawer" id="drawer"><button class="close" id="close">Close</button>
  <nav><a href="/programmes">Programmes</a><a href="/costs">Costs</a><a href="/how-it-works">How it works</a><a href="/countries">Countries</a><a href="/stories">Stories</a><a href="/faq">FAQ</a><a href="/blog">Journal</a><a href="/#contact">Contact</a></nav>
</div>
<div class="pagehead"><div class="wrap">
  <div class="crumbs"><a href="/">Home</a> · <a href="/blog">Journal</a> · ${category}</div>
  <h1>${title}</h1>
  <p>${description}</p>
  <div style="margin-top:20px"><span class="views" id="views">—</span> <span class="views">· ${human} · ${readMinutes} min</span></div>
</div></div>
<section style="padding:80px 0"><div class="wrap"><div class="prose">
${bodyHtml}
<div class="factbox"><div class="k">Not medical or legal advice</div>This article describes how programmes are structured. Eligibility and recognition depend on your country of residence — confirm your route with local counsel.</div>
</div></div></section>
<footer><div class="wrap"><div class="fbot"><span>© ${new Date().getFullYear()} ReproLegal</span><span><a href="/blog">All articles</a> · <a href="/privacy">Privacy</a></span></div></div></footer>
<script src="/assets/site.js" defer></script>
</body>
</html>
`;
}

const card = ({ slug, category, readMinutes, title, description }) => `      <a class="post reveal" href="/blog/${slug}">
        <div class="thumb"><img src="/img/prog-fet.webp" alt="" loading="lazy" /></div>
        <div class="m">${category} · ${readMinutes} min</div>
        <h3>${title}</h3>
        <p>${description}</p>
        <span class="go">Read</span>
      </a>
`;

const run = async () => {
  const topic = await nextTopic();
  console.log('Topic:', topic);

  const raw = await claude(SYSTEM, `Write the article. Topic: ${topic}`);
  const post = JSON.parse(raw.replace(/^```json|^```|```$/gm, '').trim());

  const slug = slugify(post.title);
  const now = new Date();
  const iso = now.toISOString();
  const human = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  await fs.mkdir(path.join(ROOT, 'blog'), { recursive: true });
  await fs.writeFile(path.join(ROOT, 'blog', slug + '.html'),
    articleHtml({ ...post, slug, iso, human }));

  // newest card first, right after the marker
  const idx = await fs.readFile(BLOG_INDEX, 'utf8');
  await fs.writeFile(BLOG_INDEX, idx.replace('<!-- POSTS -->', '<!-- POSTS -->\n' + card({ ...post, slug })));

  // sitemap entry
  const sm = await fs.readFile(SITEMAP, 'utf8');
  const entry = `  <url><loc>${SITE}/blog/${slug}</loc><lastmod>${iso.slice(0, 10)}</lastmod><priority>0.6</priority></url>`;
  if (!sm.includes(`/blog/${slug}<`)) {
    await fs.writeFile(SITEMAP, sm.replace('</urlset>', entry + '\n</urlset>'));
  }

  console.log('Wrote blog/' + slug + '.html');
};

run().catch(e => { console.error(e); process.exit(1); });
