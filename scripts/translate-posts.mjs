#!/usr/bin/env node
/**
 * Writes every English article that is missing in a language: blog/<slug>.html →
 * ua/blog/<slug>.html, de/blog/<slug>.html ... Existing translations are left
 * alone, so the weekly run only translates the new article and a first run
 * backfills the whole journal.
 *   node scripts/translate-posts.mjs                    everything missing
 *   node scripts/translate-posts.mjs --only=<slug>      one article (re-translates it)
 *   TRANSLATE_LIMIT=10 node scripts/translate-posts.mjs  at most ten files this run
 *   TRANSLATE_DRY=1 ...                                  no API calls; marks the text instead, for testing the pipeline
 * Requires: ANTHROPIC_API_KEY (unless TRANSLATE_DRY)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, LANGS, inDir, strings, t, claude, chrome, articleHtml, readArticle, localiseLinks, esc } from './lib/article.mjs';

const MODEL = 'claude-sonnet-5';
const DRY = !!process.env.TRANSLATE_DRY;
const LIMIT = parseInt(process.env.TRANSLATE_LIMIT || '0', 10) || Infinity;
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);
const PARALLEL = 4;

// the words the rest of the site already uses, so an article reads like its neighbours
const GLOSSARY = {
  uk: 'surrogacy = сурогатне материнство; intended parents = майбутні батьки; surrogate = сурогатна мати; egg donor = донорка яйцеклітин; IVF = ЕКЗ; embryo transfer = перенесення ембріона; birth certificate = свідоцтво про народження; apostille = апостиль; coordinator = координатор. Address the reader as «ви».',
  de: 'surrogacy = Leihmutterschaft; intended parents = Wunscheltern; surrogate = Leihmutter; egg donor = Eizellspenderin; IVF = IVF; embryo transfer = Embryotransfer; birth certificate = Geburtsurkunde; apostille = Apostille. Address the reader as „Sie“.',
  fr: 'surrogacy = gestation pour autrui (GPA); intended parents = parents d’intention; surrogate = mère porteuse; egg donor = donneuse d’ovocytes; IVF = FIV; embryo transfer = transfert d’embryon; birth certificate = acte de naissance; apostille = apostille. Address the reader as « vous ».',
  es: 'surrogacy = gestación subrogada; intended parents = padres de intención; surrogate = gestante subrogada; egg donor = donante de óvulos; IVF = FIV; embryo transfer = transferencia embrionaria; birth certificate = certificado de nacimiento; apostille = apostilla. Address the reader as «usted».',
  it: 'surrogacy = gestazione per altri (GPA) or maternità surrogata; intended parents = genitori intenzionali; surrogate = gestante; egg donor = donatrice di ovociti; IVF = PMA/FIVET; embryo transfer = transfer embrionale; birth certificate = atto di nascita; apostille = apostille. Address the reader as «tu».',
};

const system = l => `You translate articles for ReproLegal, an agency coordinating surrogacy and IVF programmes for intended parents, from British English into ${l.name}.
Write natural, precise ${l.name} for intended parents living in countries where ${l.name} is spoken — not a word-for-word rendering. Keep the calm, factual register of the original.
Rules:
- Translate everything, add nothing, drop nothing. Keep every caveat ("as of writing", "confirm with local counsel") and every range and figure exactly as given.
- Keep the HTML exactly: the same tags in the same order, the same attributes and href values. Translate only the text between tags.
- Names of laws, courts, offices and documents: use the established ${l.name} term where one exists; otherwise keep the original name and explain it briefly in the same sentence only if the original does.
- Terminology: ${GLOSSARY[l.code]}
- TITLE at most 70 characters, DESCRIPTION at most 155 characters, one line each.
Return exactly this format, nothing before or after, no markdown fences:
<<<TITLE>>>
...
<<<DESCRIPTION>>>
...
<<<LEDE>>>
...
<<<BODY>>>
...
<<<END>>>`;

const TAGS = ['a', 'p', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'strong', 'em', 'div', 'table', 'tr'];
const shape = html => TAGS.map(tag => (html.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length).join(',');
const hrefs = html => [...html.matchAll(/href="([^"]*)"/g)].map(m => m[1]).join(' ');

async function translate(src, l) {
  if (DRY) return { title: `[${l.code}] ${src.title}`, description: src.description, lede: src.lede, body: src.body };
  const user = `<<<TITLE>>>\n${src.title}\n<<<DESCRIPTION>>>\n${src.description}\n<<<LEDE>>>\n${src.lede || src.description}\n<<<BODY>>>\n${src.body}\n<<<END>>>`;
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const raw = await claude({ model: MODEL, system: system(l), user, maxTokens: 16000, thinking: { type: 'disabled' } });
    const field = (name, next) => (raw.match(new RegExp('<<<' + name + '>>>([\\s\\S]*?)<<<' + next + '>>>')) || [])[1]?.trim();
    const out = { title: field('TITLE', 'DESCRIPTION'), description: field('DESCRIPTION', 'LEDE'),
                  lede: field('LEDE', 'BODY'), body: field('BODY', 'END') };
    if (!out.title || !out.description || !out.body) { lastError = 'missing a section'; continue; }
    // a translation that lost or invented markup would break the page; ask once more, then give up
    if (shape(out.body) !== shape(src.body)) { lastError = `markup changed (${shape(src.body)} → ${shape(out.body)})`; continue; }
    if (hrefs(out.body) !== hrefs(src.body)) { lastError = 'links changed'; continue; }
    out.title = out.title.replace(/\s+/g, ' ');
    out.description = out.description.replace(/\s+/g, ' ');
    return out;
  }
  throw new Error(lastError);
}

async function exists(p) { return fs.access(p).then(() => true, () => false); }

const run = async () => {
  const files = (await fs.readdir(path.join(ROOT, 'blog'))).filter(f => f.endsWith('.html')).sort();
  const jobs = [];
  for (const f of files) {
    const slug = f.slice(0, -5);
    if (ONLY && slug !== ONLY) continue;
    for (const l of LANGS.filter(l => l.dir)) {
      if (!ONLY && await exists(inDir(l, `blog/${f}`))) continue;
      jobs.push({ slug, l });
    }
  }
  const todo = jobs.slice(0, LIMIT);
  console.log(`${jobs.length} translation(s) missing, doing ${todo.length}${DRY ? ' (dry run)' : ''}`);

  const chromes = {};
  for (const l of LANGS.filter(l => l.dir)) chromes[l.code] = await chrome(l);

  let done = 0, failed = 0;
  const work = async ({ slug, l }) => {
    const src = readArticle(await fs.readFile(path.join(ROOT, 'blog', slug + '.html'), 'utf8'));
    if (!src.title || !src.body || !src.iso) throw new Error('could not read the English article');
    const tr = await translate(src, l);
    const T = await strings(l.code);
    const html = await articleHtml({
      code: l.code, slug, iso: src.iso, category: src.category,
      readMinutes: src.readMinutes || Math.max(3, Math.round(src.body.replace(/<[^>]+>/g, ' ').split(/\s+/).length / 200)),
      title: esc(tr.title), description: esc(tr.description), lede: tr.lede,
      bodyHtml: await localiseLinks(tr.body, l), ogImage: src.ogImage, ch: chromes[l.code],
    });
    await fs.mkdir(inDir(l, 'blog'), { recursive: true });
    await fs.writeFile(inDir(l, `blog/${slug}.html`), html);
    done++;
    console.log(`  ✓ ${l.dir}/blog/${slug}  ${t(T, src.category)}`);
  };

  const queue = [...todo];
  await Promise.all(Array.from({ length: PARALLEL }, async () => {
    for (let job; (job = queue.shift());) {
      try { await work(job); }
      catch (e) { failed++; console.error(`  ✗ ${job.l.dir}/blog/${job.slug}: ${e.message}`); }
    }
  }));

  console.log(`\n${done} written, ${failed} failed`);
  // a failed article is simply missing in that language and gets retried next run;
  // only a run where nothing worked is an error worth stopping the pipeline for
  if (failed && !done) process.exit(1);
};

run().catch(e => { console.error(e); process.exit(1); });
