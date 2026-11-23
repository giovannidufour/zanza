/* apps/storefront/pages/pdp.js — Product detail page (Figma: PDP - desktop / PDP - mobile).
   A pure function: product data in, React tree out. When the commerce backend arrives,
   only the data source changes (JSON file → API), not this page. */
'use strict';
const React = require('react');
const Z = require('../../../packages/ui/components.js');
const h = React.createElement;

const { TradeActions } = require('./trade.js');
const { OfferActions } = require('./offer.js');
const { isOffers, priceText, SECTION_LABEL, tagsOf, tagLinksOf, productName, productNameLinked, smallImageUrl, releaseInfoLinked, gradingProps, SiteHeader, sampleAttrs, ProductCardFor, imageOf, IMAGE_SIZES } = require('./shell.js');

// Figma `breadcrumbs` on the PDP (decision 0122): section / genre, both links. The genre opens the section's PLP
// filtered by it (?genre=, as the genre tags); no genre → no crumb (the macro genre is never shown, 0048).
function breadcrumbItems(product, url) {
  const { listing, release } = product;
  const section = url(`/${listing.section}/`);
  const genre = (release.genres || [])[0];
  return [
    { label: SECTION_LABEL[listing.section], href: section },
    genre ? { label: genre, href: `${section}?genre=${encodeURIComponent(genre)}` } : null
  ].filter(Boolean);
}

function Pdp({ product, related = [], site, url }) {
  const { listing, release, copy, samples } = product;
  const trade = listing.section === 'trade';
  return h('div', { className: 'zz-page' },
    h(SiteHeader, { site, url, section: listing.section }),
    h(Z.Breadcrumbs, { items: breadcrumbItems(product, url) }),

    // Figma: `pdp content` — 12-col grid (desktop) / 4-col (mobile), gap gutter-small, padding-y small
    h('main', { className: 'pdp-content' },
      // Figma: `product image` ×2 / `mobile gallery` — every photo, cover first (Gio 2026-11-17: no cap, the gallery
      // scrolls on desktop and swipes on mobile)
      h(Z.Gallery, {
        className: 'pdp-content__gallery',
        images: [release.cover].concat(copy.photos).filter(Boolean).map((src, i) => imageOf(product, src, url, { sizes: IMAGE_SIZES.gallery, alt: i === 0 ? productName(release) : '' }))
      }),
      // Figma `product return card` (decision 0119, desktop): docked on the anchored gallery; scripts/site.js shows it
      // once "More for sale" covers the record and scrolls back to the record when pressed
      related.length ? h('div', { className: 'pdp-content__back', 'data-record-back': '' },
        h(Z.ProductReturnCard, {
          image: release.cover ? { src: smallImageUrl(product, release.cover, 48, url), alt: '' } : undefined,
          name: productName(release),
          price: priceText(listing),
          'aria-label': `Back to ${productName(release)}`
        })) : null,
      h(Z.ProductInfo, {
        className: 'pdp-content__info',
        title: productNameLinked(product, url),
        // trade (Figma page Trade): "Trade only" in the price slot; the description becomes Gio's note in the actions column
        // best offer (Figma page Offers, decision 0158): no price slot, the "Make an offer" CTA says it
        price: priceText(listing),
        releaseInfo: releaseInfoLinked(release, url),
        tags: tagsOf(release).length ? h(Z.TagGroup, null, tagLinksOf(release, url).map((t) => h(Z.Tag, { key: t.label, size: 'large', href: t.href }, t.label))) : null,
        description: trade ? null : copy.notes,
        ...gradingProps(copy),
        // each PlayerButton carries what the site player needs (scripts/site.js): the product's samples are its queue
        // label = the track title when there is one; without it the button is icon-only and keeps an accessible name
        samples: samples.length ? samples.map((s, i) => h(Z.PlayerButton, Object.assign({
          key: s.track_position,
          'aria-label': s.title ? undefined : `${productName(release)}, sample ${i + 1}`
        }, sampleAttrs(product, s, url)), s.title || null)) : null
      }),
      trade ? h(TradeActions, { product, site, url }) : isOffers(listing) ? h(OfferActions, { product, url }) : h('div', { className: 'pdp-content__actions' },
        h(Z.Button, { hierarchy: 'primary', size: 'large', className: 'pdp-content__cta', 'data-add-to-bag': listing.id, 'data-listing-status': listing.status }, 'Add to bag'),
        // Reserved (proposal, design/open.md): one line under the CTA explains the hold; site.js shows it live
        h('p', { className: 'pdp-content__note body-small', 'data-reserved-note': listing.id, hidden: listing.status !== 'reserved' },
          'Someone is checking out this record. If they don\u2019t buy it, it\u2019s back within 30 minutes.')),
      // Figma: `you may also like` — desktop row 2, cols 5–12; mobile below the content. Cards are h3 under its h2.
      // Figma `you may also like` + `view all` (0119): a full-width link to the whole section closes the list
      related.length ? h(Z.RelatedProducts, { className: 'pdp-content__related', title: trade ? 'More for trade:' : 'More for sale:',
        action: h(Z.Button, { hierarchy: 'secondary', size: 'large', href: url(`/${listing.section}/`) }, trade ? 'View all for trade' : 'View all for sale') },
        related.map((p) => h(ProductCardFor, { key: p.listing.slug, product: p, url, headingLevel: 3 }))) : null
    )
  );
}

module.exports = { Pdp, title: (p) => productName(p.release) };
