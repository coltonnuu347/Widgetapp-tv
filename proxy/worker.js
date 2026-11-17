// Optional Cloudflare Worker: lets the TV app read your iCloud calendar if the TV blocks
// the request (a "CORS" error). Only forwards requests to Apple's iCloud calendar servers,
// so it can't be used as an open proxy.
//
// Use it as:  https://YOUR-WORKER.workers.dev/?url=<encoded iCloud link>

export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors });

    const target = new URL(request.url).searchParams.get('url');
    let url;
    try {
      url = new URL(target.replace(/^webcals?:\/\//i, 'https://'));
    } catch (e) {
      return new Response('Missing or invalid ?url=', { status: 400, headers: cors });
    }
    if (url.protocol !== 'https:' || !/(^|\.)icloud\.com$/i.test(url.hostname)) {
      return new Response('Only iCloud calendar links are allowed', { status: 403, headers: cors });
    }

    const upstream = await fetch(url.toString(), { headers: { 'User-Agent': 'TV-Dashboard-Proxy' } });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': upstream.headers.get('Content-Type') || 'text/calendar', 'Cache-Control': 'max-age=300' }
    });
  }
};
