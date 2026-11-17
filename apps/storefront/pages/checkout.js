/* apps/storefront/pages/checkout.js — the page after a paid Stripe Checkout, /checkout/thanks/ (Figma: page Checkout →
   Checkout thanks - desktop / mobile, component `order thanks`; migration 0021). Stripe sends the buyer here with
   ?session_id=…; the page is static and shows no order details (they are in the confirmation email, sent by
   stripe-webhook). site.js sees [data-checkout-thanks] and takes the paid records out of the bag.
   Same layout as the empty bag (bag.css): title, then divider, message, note and Browse in columns 1–8. */
'use strict';
const React = require('react');
const Z = require('../../../packages/ui/components.js');
const h = React.createElement;
const { SiteHeader, textOf, Paragraphs } = require('./shell.js');

// Figma `order thanks` text properties (the note is Gio's: admin → Content → Order confirmed, decision 0106)
const MESSAGE = 'Your order is confirmed. The confirmation is on its way to your email.';

function Thanks({ site, url }) {
  return h('div', { className: 'zz-page' },
    h(SiteHeader, { site, url }),
    h('main', { className: 'bag-content', 'data-checkout-thanks': '' },
      h('h1', { className: 'bag-content__title body-large' }, 'Thank you'),
      // Figma: Browse is secondary medium, hug on desktop; secondary large, fill on mobile (as the empty bag)
      h('div', { className: 'bag-empty' },
        h(Z.Divider),
        h('p', { className: 'body-medium' }, MESSAGE),
        h(Paragraphs, { text: textOf(site, 'short.order', 'note') }),
        h(Z.Button, { hierarchy: 'secondary', size: 'medium', href: url('/sale/'), className: 'bag-empty__browse', 'data-device': 'desktop' }, 'Browse records for sale'),
        h(Z.Button, { hierarchy: 'secondary', size: 'large', href: url('/sale/'), className: 'bag-empty__browse', 'data-device': 'mobile' }, 'Browse records for sale'))));
}

module.exports = { Thanks, title: 'Thank you' };
