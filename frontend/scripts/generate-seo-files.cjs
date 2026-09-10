const fs = require('fs');
const path = require('path');

function productionOrigin() {
  const raw = process.env.REACT_APP_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || 'http://localhost:3000';
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/$/, '');
}

const origin = productionOrigin();
const routes = ['/', '/paths', '/about'];
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(route => `  <url><loc>${origin}${route}</loc></url>`).join('\n')}
</urlset>
`;
const publicDir = path.join(__dirname, '..', 'public');
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), xml);
fs.writeFileSync(path.join(publicDir, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /dashboard\nDisallow: /profile\nDisallow: /hub\nDisallow: /login\nDisallow: /signup\nSitemap: ${origin}/sitemap.xml\n`);
