export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ---- KV-backed view counter: /api/views?path=/blog/slug ----
    if (url.pathname === '/api/views') {
      const path = (url.searchParams.get('path') || '/').slice(0, 256);
      const key = 'views:' + path;
      try {
        const current = parseInt((await env.VIEWS.get(key)) || '0', 10);
        const next = current + 1;
        await env.VIEWS.put(key, String(next));
        return Response.json({ path, views: next }, {
          headers: { 'cache-control': 'no-store' }
        });
      } catch (e) {
        return Response.json({ path, views: null, error: 'kv_unavailable' }, { status: 200 });
      }
    }

    // everything else is a static asset
    return env.ASSETS.fetch(request);
  }
};
