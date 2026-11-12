export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ---- KV view counter ----------------------------------------------
    //   /api/views?path=/blog/x          -> increments and returns the count
    //   /api/views?paths=/a,/b&peek=1    -> reads several counts, no increment
    if (url.pathname === '/api/views') {
      const peek  = url.searchParams.get('peek') === '1';
      const multi = url.searchParams.get('paths');

      try {
        if (multi) {
          const list = multi.split(',').map(p => p.trim().slice(0, 256)).filter(Boolean).slice(0, 50);
          const out = {};
          await Promise.all(list.map(async p => {
            out[p] = parseInt((await env.VIEWS.get('views:' + p)) || '0', 10);
          }));
          return Response.json({ views: out }, { headers: { 'cache-control': 'no-store' } });
        }

        const path = (url.searchParams.get('path') || '/').slice(0, 256);
        const key = 'views:' + path;
        const current = parseInt((await env.VIEWS.get(key)) || '0', 10);
        if (peek) return Response.json({ path, views: current }, { headers: { 'cache-control': 'no-store' } });
        const next = current + 1;
        await env.VIEWS.put(key, String(next));
        return Response.json({ path, views: next }, { headers: { 'cache-control': 'no-store' } });
      } catch (e) {
        return Response.json({ views: null, error: 'kv_unavailable' }, { status: 200 });
      }
    }

    // ---- first-party events (no cookies, no identifiers) ----------------
    //   POST /api/e        {e, sm, lp, p, l, d} from site.js -> one KV key per event
    //   GET  /api/events?days=30   Authorization: Bearer <REPORT_TOKEN> -> the events
    // Each event says what happened, on which page and language, and the visit's
    // source/medium and landing page. No name, email, IP or id is stored, which is why
    // it can count everyone, including visitors who declined analytics cookies.
    if (url.pathname === '/api/e' && request.method === 'POST') {
      const origin = request.headers.get('origin') || '';
      if (origin && origin !== env.SITE_URL) return new Response(null, { status: 204 });
      try {
        const b = await request.json();
        if (!EVENTS.has(b.e)) return new Response(null, { status: 204 });
        const cut = (v, n = 200) => String(v || '').slice(0, n);
        const now = new Date();
        const ev = { t: now.toISOString(), e: b.e, sm: cut(b.sm, 120), lp: cut(b.lp), p: cut(b.p),
                     l: cut(b.l, 5), d: cut(b.d, 10), c: cut(request.cf && request.cf.country, 2) };
        const key = `ev:${now.toISOString().slice(0, 10)}:${now.getTime()}:${Math.random().toString(36).slice(2, 8)}`;
        // the event rides in the key's metadata, so a report is a few list calls and no reads
        await env.VIEWS.put(key, '', { metadata: ev, expirationTtl: 400 * 86400 });
      } catch (e) {}
      return new Response(null, { status: 204 });
    }

    if (url.pathname === '/api/events') {
      // trimmed: a token pasted into the dashboard easily carries a trailing newline
      const token = String(env.REPORT_TOKEN || '').trim();
      if (!token || (request.headers.get('authorization') || '').trim() !== `Bearer ${token}`) {
        return new Response('unauthorized', { status: 401 });
      }
      const days = Math.min(400, parseInt(url.searchParams.get('days') || '30', 10) || 30);
      const from = new Date(Date.now() - days * 86400e3).toISOString().slice(0, 10);
      const out = [];
      let cursor;
      do {
        const page = await env.VIEWS.list({ prefix: 'ev:', cursor });
        for (const k of page.keys) if (k.name.slice(3, 13) >= from && k.metadata) out.push(k.metadata);
        cursor = page.list_complete ? null : page.cursor;
      } while (cursor);
      return Response.json({ from, events: out }, { headers: { 'cache-control': 'no-store' } });
    }

    return env.ASSETS.fetch(request);
  }
};

const EVENTS = new Set(['form_submit', 'form_sent', 'popup_view', 'popup_lead', 'click_whatsapp',
                        'click_call', 'click_email', 'click_phone', 'contact_open']);
