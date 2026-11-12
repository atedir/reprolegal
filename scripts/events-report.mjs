#!/usr/bin/env node
/**
 * Leads and contact clicks from our own first-party events (see /api/e in _worker.js):
 * every visitor, whatever they chose on the cookie banner, with source / medium,
 * landing page, the page the action happened on, language, country and device.
 *   node scripts/events-report.mjs [days]
 * Reads the report token from ~/.config/reprolegal/report-token (or REPORT_TOKEN),
 * the same value as the Worker's REPORT_TOKEN secret. REPORT_URL overrides the site.
 */
import fs from 'node:fs';
import os from 'node:os';

const DAYS = parseInt(process.argv[2] || '30', 10);
const SITE = process.env.REPORT_URL || 'https://reprolegal.com';
const TOKEN = (process.env.REPORT_TOKEN || fs.readFileSync(os.homedir() + '/.config/reprolegal/report-token', 'utf8')).trim();

const LABEL = {
  form_sent: 'Form sent (thank-you page)', popup_lead: 'Popup lead (country guide)',
  form_submit: 'Form submit pressed', click_whatsapp: 'WhatsApp click', click_call: 'Booking click (Cal.com)',
  click_email: 'Email click', click_phone: 'Phone click', contact_open: 'Contact dock opened', popup_view: 'Popup shown',
};
const LEADS = new Set(['form_sent', 'popup_lead', 'click_whatsapp', 'click_call', 'click_email', 'click_phone']);

const res = await fetch(`${SITE}/api/events?days=${DAYS}`, { headers: { authorization: `Bearer ${TOKEN}` } });
if (!res.ok) { console.error(`${res.status} ${await res.text()}`); process.exit(1); }
const { from, events } = await res.json();

const count = (rows, keyOf) => {
  const m = new Map();
  for (const r of rows) { const k = keyOf(r); m.set(k, (m.get(k) || 0) + 1); }
  return [...m].sort((a, b) => b[1] - a[1]);
};
const pad = (s, n) => (s = String(s), s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n));
const show = (title, rows, n = 15) => {
  console.log(`\n${title}`);
  if (!rows.length) console.log('  (nothing yet)');
  for (const [k, v] of rows.slice(0, n)) console.log('  ' + pad(v, 5) + k);
};

const leads = events.filter(e => LEADS.has(e.e));
console.log(`First-party events · ${SITE} · since ${from} (${DAYS} days) · ${events.length} events, ${leads.length} leads and contact clicks`);
show('By event', count(events, e => LABEL[e.e] || e.e));

// one line per day: every lead and contact click, and how many times the popup was shown
const days = new Map();
for (const e of events) {
  const d = e.t.slice(0, 10), row = days.get(d) || { leads: 0, form: 0, popup: 0, wa: 0, call: 0, mail: 0, shown: 0 };
  if (LEADS.has(e.e)) row.leads++;
  if (e.e === 'form_sent') row.form++;
  if (e.e === 'popup_lead') row.popup++;
  if (e.e === 'click_whatsapp') row.wa++;
  if (e.e === 'click_call') row.call++;
  if (e.e === 'click_email' || e.e === 'click_phone') row.mail++;
  if (e.e === 'popup_view') row.shown++;
  days.set(d, row);
}
console.log('\nBy day (UTC)      leads  form  popup  WhatsApp  booking  email/phone  popup shown');
if (!days.size) console.log('  (nothing yet)');
for (const [d, r] of [...days].sort()) {
  console.log(`  ${d}       ${pad(r.leads, 7)}${pad(r.form, 6)}${pad(r.popup, 7)}${pad(r.wa, 10)}${pad(r.call, 9)}${pad(r.mail, 13)}${r.shown}`);
}
show('Leads and contact clicks by source / medium', count(leads, e => e.sm));
show('… by source / medium and action', count(leads, e => `${pad(e.sm, 28)} ${LABEL[e.e]}`), 25);
show('… by landing page (first page of the visit)', count(leads, e => e.lp));
show('… by page the action happened on', count(leads, e => e.p));
show('… by site language', count(leads, e => e.l));
show('… by country', count(leads, e => e.c || '?'));
show('… by device', count(leads, e => e.d));

console.log('\nLatest 20');
for (const e of events.filter(e => e.e !== 'popup_view').sort((a, b) => b.t.localeCompare(a.t)).slice(0, 20)) {
  console.log(`  ${e.t.slice(0, 16).replace('T', ' ')}  ${pad(LABEL[e.e] || e.e, 28)} ${pad(e.sm, 26)} ${pad(e.l, 3)} ${pad(e.c, 3)} ${pad(e.d, 8)} ${e.p}  ← ${e.lp}`);
}
