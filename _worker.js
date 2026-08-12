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

    return env.ASSETS.fetch(request);
  }
};
