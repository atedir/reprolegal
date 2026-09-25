#!/usr/bin/env node
/**
 * Generates one SEO article every run and commits it.
 *   node scripts/generate-post.mjs
 * Requires: ANTHROPIC_API_KEY
 * Queue: content/topics.txt (one topic per line). When empty, Claude proposes the next topic.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, claude as ask, chrome, articleHtml, lang } from './lib/article.mjs';

const MODEL = 'claude-sonnet-4-6';
const TOPICS = path.join(ROOT, 'content/topics.txt');

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
const claude = (system, user, maxTokens = 4000) => ask({ model: MODEL, system, user, maxTokens });

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

  // A short, single-purpose system prompt for this call. Reusing the article
  // prompt here made the model start writing an article instead of naming one.
  // max_tokens stays generous even though the answer is one line: a tight cap
  // can be consumed before any visible output is produced, and the script then
  // gets an empty string with no error anywhere in the logs.
  const topicSystem = `You suggest article topics for ReproLegal, an agency coordinating surrogacy and IVF programmes for intended parents. Topics must be practical and specific: law by country, what programmes cost, how to verify an agency, documents and recognition at home. No hype. Answer with the topic only, on one line, no quotes and no full stop.`;

  const proposed = await claude(topicSystem,
    `Propose ONE new article topic that is not already covered. Existing articles: ${existing}`, 600);

  const topic = proposed.split('\n').map(s => s.trim()).filter(Boolean)[0] || '';
  if (!topic || topic.length < 15) {
    throw new Error('The model returned no usable topic: ' + JSON.stringify(proposed.slice(0, 200)));
  }
  return topic;
}

// Two or three links to sibling articles. Google walks a site by links, and an
// article nothing points at gets almost no attention.
async function furtherReading(currentSlug, currentTitle, currentCat) {
  const files = (await fs.readdir(path.join(ROOT, 'blog')).catch(() => []))
    .filter(f => f.endsWith('.html') && f !== currentSlug + '.html');
  if (!files.length) return '';

  const items = [];
  for (const f of files) {
    const s = await fs.readFile(path.join(ROOT, 'blog', f), 'utf8');
    const t = (s.match(/<title>(.*?)\s*\|/s) || [])[1];
    const cat = (s.match(/· ([A-Za-z ]+)<\/div>\s*<h1>/s) || [])[1];
    const iso = (s.match(/article:published_time" content="([^"]{10})/) || [])[1] || '';
    if (t) items.push({ slug: f.slice(0, -5), title: t.trim(), cat: (cat || '').trim(), iso });
  }
  if (!items.length) return '';

  // Relevance, not recency. Same category counts most, then words shared with
  // this article's headline, then freshness as the tie-breaker.
  const STOP = new Set(('a an the and or of for to in on at by with from what which who whom how why '
    + 'is are was were be been do does did your you we our it its that this these those not no如 as '
    + 'about before after when where explained country countries surrogacy').split(/\s+/));
  const words = s => new Set(String(s).toLowerCase().match(/[a-z]{4,}/g) || []);
  const mine = new Set([...words(currentTitle)].filter(w => !STOP.has(w)));

  for (const it of items) {
    const theirs = new Set([...words(it.title)].filter(w => !STOP.has(w)));
    let shared = 0;
    for (const w of mine) if (theirs.has(w)) shared++;
    it.score = (it.cat && it.cat === currentCat ? 10 : 0) + shared * 3;
  }
  items.sort((a, b) => (b.score - a.score) || (b.iso || '').localeCompare(a.iso || ''));
  const picked = items.slice(0, 3);

  return `<h2>Further reading</h2>\n<ul>\n` +
    picked.map(i => `  <li><a href="/blog/${i.slug}">${i.title}</a></li>`).join('\n') +
    `\n</ul>\n`;
}

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

  await fs.mkdir(path.join(ROOT, 'blog'), { recursive: true });
  const ch = await chrome(lang('en'));
  post.bodyHtml += '\n' + await furtherReading(slug, post.title, post.category);
  const html = await articleHtml({ ...post, code: 'en', slug, iso, ch });

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

  // the journal listing, its translations and the sitemap are rebuilt from the
  // articles on disk by paginate-blog.py, translate-posts.mjs and build-alternates.py

  console.log('Wrote blog/' + slug + '.html');
};

run().catch(e => { console.error(e); process.exit(1); });
