/*
 * Cloudflare Pages Function, served at /florida-man.
 *
 * Searches Google News for today's date + "Florida man" (e.g. "November 10" "Florida man")
 * and returns the top result as JSON. The answer is cached until midnight GMT, so the
 * search runs at most about once a day and everyone sees the same Florida Man.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export async function onRequest(context) {
  const now = new Date();
  const day = now.getUTCDate();
  const month = MONTHS[now.getUTCMonth()];
  const today = now.toISOString().slice(0, 10);

  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const cacheKey = new Request(`https://stinkyaifric.cache/florida-man/${today}`);
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  try {
    const query = `"Florida man" "${month} ${day}"`;
    const feed = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const xml = await (await fetch(feed, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stinkyaifric.ie)' } })).text();
    const items = parseItems(xml);
    const top = items.find((i) => /florida man/i.test(i.title)) ?? items[0];
    if (!top) throw new Error('No results');

    const body = {
      date: `${day} ${month}`,
      search: `${day} ${month} Florida man`,
      searchUrl: `https://www.google.com/search?q=${encodeURIComponent(`${day} ${month} Florida man`)}`,
      title: top.title,
      source: top.source,
      link: top.link,
      year: top.published ? new Date(top.published).getUTCFullYear() : null,
    };
    const response = json(body, secondsUntilMidnightUtc(now));
    if (cache) context.waitUntil?.(cache.put(cacheKey, response.clone()));
    return response;
  } catch (err) {
    return json({ error: "Florida Man is lying low today. Try again later." }, 300, 502);
  }
}

function json(body, maxAge, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${maxAge}`,
    },
  });
}

function secondsUntilMidnightUtc(now) {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(60, Math.floor((midnight - now.getTime()) / 1000));
}

/** Pulls title / link / date / source out of each <item> in the RSS feed. */
function parseItems(xml) {
  const items = [];
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const tag = (name) => decode(item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? '');
    const source = tag('source');
    let title = tag('title');
    // Google News adds " - Source name" to the end of each headline.
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    items.push({ title, source, link: tag('link'), published: tag('pubDate') });
  }
  return items;
}

function decode(text) {
  return text
    .replace(/^<!\[CDATA\[|\]\]>$/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .trim();
}
