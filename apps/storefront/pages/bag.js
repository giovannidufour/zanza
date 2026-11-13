/* apps/storefront/pages/bag.js — the bag (Figma: page Bag → Bag - desktop / Bag - mobile, decision 0044).
   The bag lives in the visitor's browser (scripts/site.js, localStorage: listing ids), the page is static: it carries a
   BagItem for every listing of the sale section, hidden, and site.js shows the ones in the bag, in the order they were
   added, computes the subtotal and swaps to the empty state. A copy is unique: one line per copy, no quantity.
   Adding to the bag does not hold the copy: the 30 min hold starts at checkout (_context/backend.md). A listing that
   is no longer available shows its notice: sold = name struck through, "SOLD OUT" beside the struck price (decision 0064), reserved (held by
   another checkout) = the same with "RESERVED" (decision 0065). Only available lines count in the subtotal.
   Shipping (decision 0057, Figma `bag summary` destination=served | not served): when shipping is set up (admin page
   Shipping), the summary has a "Ship to" country select and a total; the page carries the shipping config as JSON and
   site.js estimates with packages/shipping/shipping.js. create-checkout recalculates on the server.
   Minimum order (decision 0072, Figma `bag summary` minimum=below): the page carries the minimum (admin page Shipping)
   in data-min-order-cents; under it site.js shows the `minimum note` and disables Checkout. */
'use strict';
const React = require('react');
const Z = require('../../../packages/ui/components.js');
const h = React.createElement;
const { formatPrice, productName, productNameLinked, releaseInfo, gradingProps, productHref, SiteHeader, sampleAttrs } = require('./shell.js');

// the BagItem status of a listing status (Figma `bag item` status); `reserved` = held by a checkout or by hand
const BAG_STATUS = { available: 'available', sold: 'sold', traded: 'sold' };

function BagLine({ product, url }) {
  const { listing, release, copy, samples } = product;
  const available = listing.status === 'available';
  return h('li', { className: 'bag-list__line', hidden: true, 'data-bag-line': listing.id,
      'data-price': listing.price ? listing.price.amount : 0, 'data-available': available ? 'true' : 'false',
      'data-listing-status': listing.status,
      'data-format': release.format || '', 'data-weight': listing.weight_g || '' },
    h(Z.Divider),
    h(Z.BagItem, {
      status: BAG_STATUS[listing.status] || 'reserved',
      href: productHref(product, url),
      image: release.cover ? { src: url(release.cover), alt: '' } : null,
      title: productName(release),
      releaseInfo: releaseInfo(release),
      price: listing.price ? formatPrice(listing.price) : null,
      ...gradingProps(copy),
      // samples stay on every line, sold ones too (Gio 2026-11-10); same labels as the cards (1, 2…)
      samples: samples.length ? samples.map((s, i) => h(Z.PlayerButton, Object.assign({
        key: s.track_position,
        'aria-label': `${productName(release)}, sample ${i + 1}: ${s.title}`
      }, sampleAttrs(product, s, url)), String(i + 1))) : null
    }));
}

// Figma: Bag - desktop (`bag content`: 12-col grid, title row 1 cols 1–12, list cols 1–8, summary cols 9–12) /
// Bag - mobile (one column). The empty state replaces list and summary.
// the served note and the not-served one (Figma `note` of each variant); site.js swaps them
const NOTE = 'You pay on Stripe. Your records are held for 30 minutes once you start checkout.';
const NOTE_SHIPPING = 'Shipping is an estimate for your country. You enter the address and pay on Stripe. Your records are held for 30 minutes once you start checkout.';
const DEFAULT_COUNTRY = 'DE';   // Figma: Ship to → Germany

function Bag({ products, site, url, shipping, countries }) {
  const withShipping = !!(shipping && (shipping.rates || []).length);
  // minimum order (decision 0072): in the shipping settings, but independent of the rates
  const minimum = shipping && shipping.min_order_cents > 0 ? shipping.min_order_cents : 0;
  return h('div', { className: 'zz-page' },
    h(SiteHeader, { site, url, current: 'bag' }),
    h('main', { className: 'bag-content', 'data-bag-page': '' },
      h('h1', { className: 'bag-content__title body-large' }, 'Bag'),
      h('ul', { className: 'bag-list', 'data-bag-list': '', hidden: true },
        products.map((p) => h(BagLine, { key: p.listing.id, product: p, url }))),
      h(Z.BagSummary, {
        className: 'bag-content__summary',
        hidden: true,
        'data-bag-summary': '',
        'data-min-order-cents': minimum || undefined,
        subtotalLabel: h('span', { 'data-bag-subtotal-label': '' }, 'Subtotal (0 records)'),
        subtotal: h('span', { 'data-bag-subtotal': '' }, formatPrice({ amount: 0 })),
        // TODO checkout: create-checkout (hold + Stripe Checkout session) is not built yet (_context/backend.md)
        checkoutProps: { 'data-bag-checkout': '' },
        // sold lines are not in the order (decision 0064): site.js fills and shows it
        soldOutNoteProps: { 'data-bag-sold-out': '', hidden: true },
        // minimum order (decision 0072, Figma `bag summary` minimum=below): site.js fills it, disables Checkout and
        // points Checkout's aria-describedby at it while the available records are under the minimum
        minimumNoteProps: { id: 'bag-minimum', 'data-bag-minimum': '', 'aria-live': 'polite', hidden: true },
        ...(withShipping ? {
          shipTo: h(Z.Input, { variant: 'select', label: 'Ship to', id: 'bag-ship-to', 'data-bag-ship-to': '', defaultValue: DEFAULT_COUNTRY },
            countries.map((c) => h('option', { key: c.code, value: c.code }, c.name))),
          shipping: h('span', { 'data-bag-shipping': '' }, 'Calculated at checkout'),
          total: h('span', { 'data-bag-total': '' }, formatPrice({ amount: 0 })),
          note: h('span', { 'data-bag-note': '' }, NOTE_SHIPPING)
        } : { note: NOTE })
      }),
      withShipping ? h('script', { type: 'application/json', 'data-shipping-config': '',
        dangerouslySetInnerHTML: { __html: JSON.stringify(shipping).replace(/</g, '\\u003c') } }) : null,
      // Figma: Bag · empty — desktop: Browse is secondary medium, hug; mobile: secondary large, fill
      h('div', { className: 'bag-empty', 'data-bag-empty': '' },
        h(Z.Divider),
        h('p', { className: 'body-medium' }, 'Your bag is empty.'),
        h(Z.Button, { hierarchy: 'secondary', size: 'medium', href: url('/sale/'), className: 'bag-empty__browse', 'data-device': 'desktop' }, 'Browse records for sale'),
        h(Z.Button, { hierarchy: 'secondary', size: 'large', href: url('/sale/'), className: 'bag-empty__browse', 'data-device': 'mobile' }, 'Browse records for sale'))
    )
  );
}

module.exports = { Bag, title: 'Bag' };
