#!/usr/bin/env node
/**
 * Where the search clicks come from: top queries, pages, site languages,
 * searcher countries and devices from Google Search Console.
 *   GSC_SA_KEY="$(cat ~/.config/reprolegal/gtm-key.json)" node scripts/gsc-report.mjs [days]
 * The service account must be a user on the reprolegal.com property (see scripts/gsc.mjs).
 */
import { connect, query } from './gsc.mjs';

const DAYS = parseInt(process.argv[2] || '90', 10);
const pct = x => (x * 100).toFixed(1) + '%';
const pad = (s, n) => String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s).padEnd(n);

function table(title, rows, label, n = 15) {
  console.log(`\n${title}`);
  console.log('  ' + pad(label, 58) + pad('clicks', 8) + pad('impr.', 9) + pad('CTR', 8) + 'pos.');
  for (const r of rows.slice(0, n)) {
    console.log('  ' + pad(r.key, 58) + pad(r.clicks, 8) + pad(r.impressions, 9) + pad(pct(r.ctr), 8) + r.position.toFixed(1));
  }
  if (!rows.length) console.log('  (no data yet)');
}

const shape = rows => rows.map(r => ({ key: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }))
  .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);

let conn;
try { conn = await connect(); }
catch (e) { console.error(e.message); process.exit(1); }
if (!conn) { console.error('Set GSC_SA_KEY to the service account JSON.'); process.exit(1); }

const byQuery = await query(conn, { dimensions: ['query'], days: DAYS });
const byPage = await query(conn, { dimensions: ['page'], days: DAYS });
const byCountry = await query(conn, { dimensions: ['country'], days: DAYS });
const byDevice = await query(conn, { dimensions: ['device'], days: DAYS });

const pages = shape(byPage.rows).map(r => ({ ...r, key: r.key.replace(/^https?:\/\/[^/]+/, '') || '/' }));
const total = pages.reduce((t, r) => ({ clicks: t.clicks + r.clicks, impressions: t.impressions + r.impressions }), { clicks: 0, impressions: 0 });

// the same pages, grouped by the site language they were served in
const langOf = p => (p.match(/^\/(ua|de|fr|es|it)(\/|$)/) || [, 'en'])[1];
const byLang = {};
for (const r of pages) {
  const l = langOf(r.key);
  byLang[l] = byLang[l] || { key: l, clicks: 0, impressions: 0, pos: 0 };
  byLang[l].clicks += r.clicks; byLang[l].impressions += r.impressions; byLang[l].pos += r.position * r.impressions;
}
const langs = Object.values(byLang).map(l => ({ ...l, ctr: l.impressions ? l.clicks / l.impressions : 0,
  position: l.impressions ? l.pos / l.impressions : 0 })).sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);

console.log(`Search Console · ${conn.site} · ${byQuery.start} → ${byQuery.end} (${DAYS} days)`);
console.log(`Total: ${total.clicks} clicks, ${total.impressions} impressions, CTR ${pct(total.impressions ? total.clicks / total.impressions : 0)}`);
table('By query', shape(byQuery.rows), 'query', 25);
table('By page', pages, 'page', 20);
table('By site language', langs, 'language');
table('By searcher country', shape(byCountry.rows), 'country (ISO 3166-1 alpha-3)');
table('By device', shape(byDevice.rows), 'device');
