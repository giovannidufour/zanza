/* apps/storefront/pages/offer.js — best offer (Figma page `Offers`, migration 0034, decision 0158).
   A sale copy with price mode "offers" has no price: buyers send an offer, Gio accepts or declines it in the admin.
   Pure functions: data in, React tree out. scripts/site.js runs the forms (initPriceOffer, initOfferConfirm, initOfferPay)
   against the Supabase function `offer` (site.json → offers.endpoint).
   - OfferActions: the PDP actions of a best-offer copy (Figma `offer actions`, state open | reserved | sold)
   - PriceOffer: /products/<slug>/offer/ — Figma `price offer` + `offer sent · price` (check email), hidden until sent
   - OfferConfirm: /offer/confirm/?t=… — the email link: confirms the offer (Figma `offer sent · price` confirmed | link expired)
   - OfferPay: /offer/pay/?t=… — the link of an accepted offer: the record goes in the Bag, no sign-in
     (decisions 0186, 0188; Figma `offer pay` ready | expired | paid) */
'use strict';
const React = require('react');
const Z = require('../../../packages/ui/components.js');
const h = React.createElement;
const { SiteHeader } = require('./shell.js');
const { OfferTarget } = require('./trade.js');

const offerHref = (product, url) => url(`/products/${product.listing.slug}/offer/`);
const DEFAULT_COUNTRY = 'DE';   // as the Bag: Germany first, else the first country the shop ships to
const signature = (site) => ((site.owner || {}).name ? `— ${site.owner.name}` : null);

// Figma `offer actions`: open → Make an offer; reserved (an accepted offer is being paid) → (Reserved) Notify me, or for
// the offer's buyer (accepted, 0190) Add to bag; sold → Sold out
const ACTION_TEXT = {
  available: 'No fixed price. Offer what it’s worth to you: I read every offer and answer by email.',
  reserved: 'An offer was accepted. If it isn’t paid within 48 h, the record is back and open to offers.'
};
function OfferActions({ product, url }) {
  const { listing } = product;
  const st = listing.status === 'available' || listing.status === 'reserved' ? listing.status : 'sold';
  return h('div', { className: 'pdp-content__actions trade-actions' },
    h('div', { className: 'trade-actions__cta' },
      st === 'available'
        ? h(Z.Button, { hierarchy: 'primary', size: 'large', className: 'pdp-content__cta', href: offerHref(product, url) }, 'Make an offer')
        // reserved (decision 0189): as any reserved copy, site.js makes it "(Reserved) Notify me" (the offer's buyer: "In bag")
        : st === 'reserved'
          ? h(Z.Button, { hierarchy: 'primary', size: 'large', className: 'pdp-content__cta', 'data-add-to-bag': listing.id,
              'data-listing-status': listing.status, 'data-offer-href': offerHref(product, url) }, 'Make an offer')
          : h(Z.Button, { hierarchy: 'primary', size: 'large', className: 'pdp-content__cta', disabled: true }, 'Sold out'),
      // reserved: site.js swaps the line for the buyer of the accepted offer (state=accepted, decision 0190)
      ACTION_TEXT[st] ? h('p', { className: 'body-small', 'data-offer-note': st === 'reserved' ? listing.id : undefined }, ACTION_TEXT[st]) : null));
}

// the sent / confirmed / expired blocks share Figma `offer sent` (divider, title, body, signature, button)
function SentBlock({ title, children, site, button, props }) {
  return h('div', Object.assign({ className: 'trade-col trade-col--2 trade-sent' }, props),
    h(Z.Divider),
    h('h2', { className: 'label-small', 'data-offer-state-title': '' }, title),
    h('p', { className: 'body-medium', 'data-offer-state-body': '' }, children),
    signature(site) && h('p', { className: 'trade-sent__signature body-small' }, signature(site)),
    button);
}

// Figma `price offer` in the `Offer form` screens: record (col 1), form (col 2). The form's own puzzle (0132) starts as
// the page opens. Ship to lists only the countries the shop ships to (as the Bag); no shipping set up = a code field.
function PriceOffer({ product, site, url, countries }) {
  const endpoint = (site.offers || {}).endpoint || '';
  const list = countries || [];
  const def = list.some((c) => c.code === DEFAULT_COUNTRY) ? DEFAULT_COUNTRY : (list[0] || {}).code;
  return h('div', { className: 'hm-page' },
    h(SiteHeader, { site, url, section: 'sale' }),
    h('main', { className: 'trade-content', 'data-price-offer-page': '' },
      h('h1', { className: 'trade-content__title body-large', 'data-offer-title': '' }, 'Make an offer'),
      h('div', { className: 'trade-col trade-col--1' }, h(Z.Divider), h(OfferTarget, { product, url })),
      h('form', { className: 'trade-col trade-col--2', noValidate: true, 'data-price-offer-form': '', 'data-listing-id': product.listing.id,
        'data-endpoint': endpoint },
        h(Z.Divider),
        h(Z.Input, { label: 'Your offer', name: 'amount', required: true, inputMode: 'decimal', autoComplete: 'off', placeholder: '0', suffix: '€',
          maxLength: 9, supportText: 'Shipping is added when you pay.' }),
        list.length
          ? h(Z.Input, { variant: 'select', label: 'Ship to', name: 'country', required: true, defaultValue: def, supportText: 'So I know what shipping costs.' },
              list.map((c) => h('option', { key: c.code, value: c.code }, c.name)))
          : h(Z.Input, { label: 'Ship to', name: 'country', required: true, maxLength: 2, placeholder: 'Country code, e.g. DE', supportText: 'So I know what shipping costs.' }),
        h(Z.Input, { label: 'Email', name: 'email', type: 'email', required: true, autoComplete: 'email', placeholder: 'you@example.com',
          supportText: 'I send you a link to confirm the offer. It reaches me only after that.' }),
        h(Z.Input, { variant: 'text-area', label: 'Note', optional: true, name: 'note', maxLength: 1000, placeholder: 'Anything I should know?' }),
        // honeypot: hidden from people, bots fill it (the function drops those offers)
        h('div', { className: 'hm-visually-hidden', 'aria-hidden': 'true' },
          h('label', null, 'Website', h('input', { type: 'text', name: 'website', tabIndex: -1, autoComplete: 'off' }))),
        // Figma `offer submit`: fine print, error line, Send offer
        h('p', { className: 'body-small' }, 'Nothing is agreed until I say yes. If I accept, the record is held for you for 48 h and you can buy it from your Bag. ',
          h('a', { className: 'trade-link', href: url('/privacy/') }, 'Privacy')),
        h('p', { className: 'trade-form__error body-small', role: 'alert', hidden: true, 'data-offer-error': '' }),
        h(Z.Button, { type: 'submit', hierarchy: 'primary', className: 'trade-form__send', 'data-offer-send': '' }, 'Send offer')),
      // Figma `offer sent · price` state=check email: site.js fills the email and the amount
      h(SentBlock, { site, title: 'Check your email', props: { hidden: true, 'data-price-offer-sent': '' },
        button: h(Z.Button, { hierarchy: 'secondary', href: url('/sale/') }, 'More records for sale') },
        'I sent a link to ', h('span', { 'data-offer-sent-email': '' }), '. Open it to confirm your offer of ', h('span', { 'data-offer-sent-amount': '' }),
        ': it reaches me only after that. The link works for 24 h.')));
}

// a record picked at run time (confirm and pay pages): Figma `offer target` with empty slots site.js fills
function LiveTarget({ label }) {
  return h('div', { className: 'offer-target', hidden: true, 'data-offer-target': '' },
    h('img', { className: 'offer-target__image', alt: '', width: 80, height: 80, hidden: true, 'data-offer-target-image': '' }),
    h('div', { className: 'offer-target__text' },
      h('p', { className: 'offer-target__label body-small', 'data-offer-target-label': '' }, label),
      h('p', { className: 'body-large', 'data-offer-target-name': '' }),
      h('a', { className: 'trade-link body-small', href: '#', 'data-offer-target-link': '' }, 'Back to the record')));
}

// /offer/confirm/?t=… (Figma `Offer confirmed - desktop`): site.js posts the token and shows one of the states
function OfferConfirm({ site, url }) {
  const endpoint = (site.offers || {}).endpoint || '';
  const more = h(Z.Button, { hierarchy: 'secondary', href: url('/sale/') }, 'More records for sale');
  return h('div', { className: 'hm-page' },
    h(SiteHeader, { site, url, section: 'sale' }),
    h('main', { className: 'trade-content', 'data-offer-confirm-page': '', 'data-endpoint': endpoint, 'data-products-base': url('/products/') },
      h('h1', { className: 'trade-content__title body-large' }, 'Make an offer'),
      h('div', { className: 'trade-col trade-col--1' }, h(Z.Divider), h(LiveTarget, { label: 'You want' })),
      h(SentBlock, { site, title: 'Confirming your offer…', props: { 'data-offer-state': 'loading' }, button: more },
        'One moment.'),
      h(SentBlock, { site, title: 'Offer sent', props: { hidden: true, 'data-offer-state': 'confirmed' }, button: more },
        'Your offer of ', h('span', { 'data-offer-amount': '' }), ' for ', h('span', { 'data-offer-name': '' }),
        ' is with me. I answer you by email within a couple of days. If I accept, the record goes in your Bag at that price.'),
      h(SentBlock, { site, title: 'This link has expired', props: { hidden: true, 'data-offer-state': 'expired' }, button: more },
        'Confirmation links work for 24 h. Send your offer again from the record’s page.'),
      h(SentBlock, { site, title: 'This link doesn’t work', props: { hidden: true, 'data-offer-state': 'invalid' }, button: more },
        'Check that you opened the whole link from the email, or send your offer again from the record’s page.')));
}

// /offer/pay/?t=… — the link of the acceptance email (decision 0188, replaces the sign-in of 0186 and the pay page of
// 0158). Figma `Offer pay - desktop · ready`, `offer pay` state = ready | expired | paid. site.js reads the offer
// (function `offer`, pay-info): ready → the copy goes in the Bag with the link's token and the Bag opens (the ready block
// shows only if that fails, e.g. no storage). Expired / paid / closed / invalid as before.
function OfferPay({ site, url }) {
  const endpoint = (site.offers || {}).endpoint || '';
  const more = h(Z.Button, { hierarchy: 'secondary', href: url('/sale/') }, 'More records for sale');
  return h('div', { className: 'hm-page' },
    h(SiteHeader, { site, url, section: 'sale' }),
    h('main', { className: 'trade-content', 'data-offer-pay-page': '', 'data-endpoint': endpoint, 'data-products-base': url('/products/'),
      'data-bag-url': url('/bag/') },
      h('h1', { className: 'trade-content__title body-large' }, 'Your offer was accepted'),
      h('div', { className: 'trade-col trade-col--1' }, h(Z.Divider), h(LiveTarget, { label: 'Yours for' })),
      h(SentBlock, { site, title: 'One moment…', props: { 'data-offer-state': 'loading' }, button: null }, 'Loading your offer.'),
      // Figma `offer pay` state=ready
      h('div', { className: 'trade-col trade-col--2 trade-sent', hidden: true, 'data-offer-state': 'ready' },
        h(Z.Divider),
        h('h2', { className: 'label-small' }, 'In your Bag at your price'),
        h('p', { className: 'body-medium' }, 'The record goes in your Bag at ', h('span', { 'data-offer-amount': '' }),
          '. Add other records and pay once, with one shipping.'),
        h(Z.Button, { hierarchy: 'primary', href: url('/bag/'), 'data-offer-to-bag': '' }, 'Go to your Bag'),
        h('p', { className: 'body-small', 'data-offer-held': '' })),
      h(SentBlock, { site, title: 'This offer has expired', props: { hidden: true, 'data-offer-state': 'expired' },
        button: h(Z.Button, { hierarchy: 'secondary', href: url('/sale/'), 'data-offer-back': '' }, 'Back to the record') },
        'The 48 h are over and the record is open to offers again. You can send a new offer from its page.'),
      h(SentBlock, { site, title: 'Already paid', props: { hidden: true, 'data-offer-state': 'paid' }, button: more },
        'This offer has been paid. Your order confirmation is in your email.'),
      h(SentBlock, { site, title: 'This offer is closed', props: { hidden: true, 'data-offer-state': 'closed' }, button: more },
        'The record has found another home in the meantime.'),
      h(SentBlock, { site, title: 'This link doesn’t work', props: { hidden: true, 'data-offer-state': 'invalid' }, button: more },
        'Check that you opened the whole link from the email.')));
}

module.exports = { OfferActions, PriceOffer, OfferConfirm, OfferPay, offerHref };
