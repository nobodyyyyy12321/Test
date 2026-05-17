import { getArticles } from '../../lib/articles-supabase';

type SitemapUrl = {
  loc: string;
  priority?: string;
  lastmod?: string;
};

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;'
  } as any)[c]);
}

export async function GET() {
  try {
    let articles: any[] = [];
    if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      try {
        articles = await getArticles();
      } catch (e) {
        console.error('sitemap: error fetching articles from Firestore', e);
        articles = [];
      }
    } else {
      console.warn('sitemap: Firebase env not set, skipping articles in sitemap');
    }

    const base = 'https://exam.farm';

    const staticUrls: SitemapUrl[] = [
      { loc: `${base}/`, priority: '1.0' },
      { loc: `${base}/links`, priority: '0.6' },
      { loc: `${base}/ranking`, priority: '0.6' },
      { loc: `${base}/stats`, priority: '0.6' },
    ];

    const articleUrls: SitemapUrl[] = articles
      .filter(a => a.number || a.id)
      .map(a => {
        const category = a.category ? encodeURIComponent(String(a.category)) : 'article';
        const idPart = a.number ? String(a.number) : encodeURIComponent(a.id);
        const loc = `${base}/${category}/${idPart}`;
        const lastmod = a.updatedAt || a.createdAt;
        return { loc, lastmod } as SitemapUrl;
      });

    const urls: SitemapUrl[] = [...staticUrls, ...articleUrls];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u: SitemapUrl) => {
        const lastmodTag = u.lastmod ? `<lastmod>${escapeXml(new Date(u.lastmod).toISOString())}</lastmod>` : '';
        const priorityTag = u.priority ? `<priority>${u.priority}</priority>` : '';
        return `  <url>\n    <loc>${escapeXml(u.loc)}</loc>\n    ${lastmodTag}\n    ${priorityTag}\n  </url>`;
      })
      .join('\n')}\n</urlset>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=0, s-maxage=3600'
      },
    });
  } catch (err) {
    console.error('Failed to generate sitemap:', err);
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://exam.farm/</loc>\n  </url>\n</urlset>`;
    return new Response(fallback, { headers: { 'Content-Type': 'application/xml' } });
  }
}
