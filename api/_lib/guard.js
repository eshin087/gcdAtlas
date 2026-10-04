// Shared protection for the /api functions (see docs/SECURITY.md).
// - Only a plain GET of the bare path is served. Vercel's edge cache keys on the full URL, so a query string
//   (/api/sats?x=1, ?x=2, ...) would make every request a cache miss that runs the function and hits the upstream API.
// - A warm function instance keeps its last good answer for `minAge` ms, and requests that arrive together share one
//   upstream fetch. If the upstream fails, the last good answer is served (marked stale) instead of an error.
// - `load()` gives the body: a string (JSON, the default), or a Buffer with `type` set (an image). It may also give
//   `{ body, headers }` to add response headers (the clouds' date); the headers are kept with the warm copy.
const isBody = x => typeof x === 'string' || Buffer.isBuffer(x);
export function cachedHandler({ minAge, load, sMaxAge, swr, what, type = 'application/json; charset=utf-8' }){
  let memo = null, inflight = null;
  const send = (res, extra) => {
    for (const [k, v] of Object.entries(memo.headers)) res.setHeader(k, v);
    res.setHeader('Cache-Control', extra);
    res.setHeader('Content-Type', type);
    return res.status(200).send(memo.body);
  };
  return async function handler(req, res){
    if (req.method !== 'GET' && req.method !== 'HEAD'){ res.setHeader('Allow', 'GET, HEAD'); return res.status(405).end(); }
    if ((req.url || '').includes('?')){ res.setHeader('Cache-Control', 'public, s-maxage=86400'); return res.status(404).json({ error:'not found' }); }
    try {
      if (!memo || Date.now() - memo.at > minAge){
        inflight = inflight || load().finally(() => { inflight = null; });
        const out = await inflight;
        memo = { at:Date.now(), body:isBody(out) ? out : out.body, headers:isBody(out) ? {} : (out.headers || {}) };
      }
      return send(res, `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`);
    } catch (e){
      console.error(what + ' upstream failed:', e && e.message);   // (logged for us; not sent to the visitor)
      if (memo) return send(res, 'public, s-maxage=600');
      res.setHeader('Cache-Control', 'public, s-maxage=600');
      return res.status(502).json({ error:what + ' unavailable' });
    }
  };
}
