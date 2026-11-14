/* apps/storefront/pages/seo.js — what search engines and link previews read (decision 0084).
   Pure functions: the <head> tags of a page, the PDP description and JSON-LD, sitemap.xml, robots.txt and the
   Cloudflare Pages _headers / _redirects. Everything absolute starts from site.json → siteUrl (the domain, no
   trailing slash): empty = the site is not launched yet, so every page is noindex, robots.txt disallows all and
   there is no canonical, og:url or sitemap. Changing domain = changing that one value. */
'use strict';
const { productName, releaseInfo, formatPrice, grading, coverGrading } = require('./shell.js');

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');

// schema.org availability of a listing (decision 0084): a reserved copy is a 30-minute checkout hold, so it is still
// on offer; sold = SoldOut (the page stays indexed: samples and details are still useful, and the record may come back)
const AVAILABILITY = {
  available: 'https://schema.org/InStock',
  reserved: 'https://schema.org/LimitedAvailability',
  sold: 'https://schema.org/SoldOut'
};

// the meta description of a product page, ~155 characters: name, format and label, genres, grade, price or state
function productDescription(product) {
  const { listing, release, copy } = product;
  const sold = listing.status === 'sold' || listing.status === 'traded';
  const parts = [
    `${productName(release)}. ${releaseInfo(release) || 'Vinyl'}${(release.genres || []).length ? ', ' + release.genres.join(', ') : ''}.`,
    [grading(copy), coverGrading(copy)].filter(Boolean).join(', ') + '.',
    listing.section === 'trade'
      ? (sold ? 'Traded.' : 'Not for sale: make a trade offer.')
      : (sold ? 'Sold out.' : `${listing.price ? formatPrice(listing.price) + ', ' : ''}listen to the samples.`)
  ];
  return clip(parts.join(' ').replace(/\s+/g, ' '), 160);
}

// JSON-LD of a product page (sale section only: a trade copy has no price, and a Product with no offer is not valid
// for Google). Used vinyl, one copy, EUR.
function productJsonLd(product, { abs }) {
  const { listing, release, copy } = product;
  if (listing.section !== 'sale' || !listing.price) return null;
  const images = [release.cover].concat(copy.photos || []).filter(Boolean).map(abs).filter(Boolean);
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: productName(release),
    description: productDescription(product),
    category: 'Media > Music & Sound Recordings > Records & LPs',
    image: [...new Set(images)],
    sku: listing.sku || undefined,
    offers: {
      '@type': 'Offer',
      price: (listing.price.amount / 100).toFixed(2),
      priceCurrency: listing.price.currency || 'EUR',
      availability: AVAILABILITY[listing.status] || AVAILABILITY.sold,
      itemCondition: 'https://schema.org/UsedCondition',
      url: abs(`/products/${listing.slug}/`) || undefined
    }
  };
  // "</" can never close the script tag
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/* the SEO part of <head>. meta = { description, path (the page's own path, for canonical and og:url),
   index (false = noindex, follow), image (absolute or site path), imageAlt, jsonLd }. */
function headTags(meta, { site, title, abs }) {
  const launched = !!site.siteUrl;
  const index = launched && meta.index !== false;
  const out = [];
  if (meta.description) out.push(`<meta name="description" content="${esc(meta.description)}">`);
  if (!index) out.push('<meta name="robots" content="noindex, follow">');
  const pageUrl = launched && meta.path ? abs(meta.path) : null;
  if (pageUrl && index) out.push(`<link rel="canonical" href="${esc(pageUrl)}">`);
  // Open Graph / Twitter: the preview of a link shared on Instagram, WhatsApp, Discogs
  const image = meta.image ? abs(meta.image) : null;
  out.push(`<meta property="og:site_name" content="${esc(site.storeName)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${esc(title)}">`);
  if (meta.description) out.push(`<meta property="og:description" content="${esc(meta.description)}">`);
  if (pageUrl) out.push(`<meta property="og:url" content="${esc(pageUrl)}">`);
  if (image) {
    out.push(`<meta property="og:image" content="${esc(image)}">`);
    if (meta.imageAlt) out.push(`<meta property="og:image:alt" content="${esc(meta.imageAlt)}">`);
  }
  out.push(`<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`);
  if (meta.jsonLd) out.push(`<script type="application/ld+json">${meta.jsonLd}</script>`);
  return out.join('\n') + '\n';
}

// sitemap.xml: only the indexable pages (the build passes them), absolute
function sitemap(paths, { abs }) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    paths.map((p) => `  <url><loc>${esc(abs(p))}</loc></url>`).join('\n') + '\n</urlset>\n';
}

function robots(site, { abs }) {
  if (!site.siteUrl) return '# Not launched yet (site.json → siteUrl is empty): nothing to index.\nUser-agent: *\nDisallow: /\n';
  return `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`;
}

// Cloudflare Pages: the *.pages.dev addresses (production and previews) never get indexed, so the shop exists for
// search engines only on its own domain (https://developers.cloudflare.com/pages/configuration/headers/)
const PAGES_HEADERS = `https://:project.pages.dev/*
  X-Robots-Tag: noindex

https://:version.:project.pages.dev/*
  X-Robots-Tag: noindex
`;
// the root has no page of its own yet: a real 301 instead of the meta refresh of index.html (kept for other hosts)
const pagesRedirects = (url) => `/ ${url('/sale/')} 301\n`;

const sectionDescription = (section) => (section === 'trade'
  ? 'Reggae and dancehall records from my own crates, not for sale: make me an offer with a record of yours.'
  : 'Reggae and dancehall 7" and 12" records from a DJ’s own crates. Graded copies, listen to the samples before you buy.');

module.exports = { headTags, productDescription, productJsonLd, sitemap, robots, PAGES_HEADERS, pagesRedirects, sectionDescription, AVAILABILITY };
