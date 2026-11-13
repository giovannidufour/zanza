/* apps/storefront/pages/trade.js — the trade side (Figma page `Trade`, proposal 2026-11-12, decision 0068).
   "This record isn't for sale, convince me": a trader makes an offer, Gio answers personally by email.
   Pure functions: data in, React tree out. scripts/site.js runs the offer form (add a record, send, sent state).
   - TradeActions: the PDP actions of a trade listing (Make an offer, the deal in one line, note, Discogs card)
   - Offer: /products/<slug>/offer/ — the offer form; its "sent" state is in the same page (hidden until sent)
   - HowTrading: /how-trading-works/
   - About: /about/ */
'use strict';
const React = require('react');
const Z = require('../../../packages/ui/components.js');
const h = React.createElement;
const { SiteHeader, productName, releaseInfo, grading, coverGrading, productHref } = require('./shell.js');

// Gio's grading scale (Q8, table public.grades; the same list as apps/admin/admin.js GRADES)
const GRADES = ['M', 'NM', 'NM-', 'EX+', 'EX', 'EX-', 'VG+', 'VG', 'VG-', 'G+', 'G', 'G-', 'F'];
const offerHref = (product, url) => url(`/products/${product.listing.slug}/offer/`);
// no shipping rule on the site (Gio 2026-11-12): the deal is found in the conversation
const PITCH = 'Not for sale. Convince me with a trade: show me what you\u2019ve got, and who you are.';

// Figma `discogs card`, filled from site.json → owner.discogs
const OwnerDiscogs = ({ site, label }) => {
  const d = (site.owner || {}).discogs || {};
  return h(Z.DiscogsCard, { label: label || 'On Discogs', handle: d.username, stats: d.stats, href: d.href });
};

// Figma `trade actions` + `trade note` + `discogs card`: the PDP actions column of a trade listing.
// The description written in the admin is the note ("why it's not for sale"), in place of the product info description.
function TradeActions({ product, site, url }) {
  const { listing, copy } = product;
  const open = listing.status === 'available';
  return h('div', { className: 'pdp-content__actions trade-actions' },
    h('div', { className: 'trade-actions__cta' },
      open
        ? h(Z.Button, { hierarchy: 'primary', size: 'large', className: 'pdp-content__cta', href: offerHref(product, url) }, 'Make an offer')
        : h(Z.Button, { hierarchy: 'primary', size: 'large', className: 'pdp-content__cta', disabled: true },
            listing.status === 'traded' ? 'Traded' : 'Reserved'),
      h('p', { className: 'body-small' }, open ? PITCH
        : listing.status === 'traded' ? 'This one found a new home.' : 'I’ve accepted an offer for this record. If it falls through, it’s open again.'),
      h('a', { className: 'trade-link trade-actions__link body-small', href: url('/how-trading-works/') }, 'How trading works')),
    copy.notes ? h(Z.TradeNote, { signature: `— ${(site.owner || {}).name || ''}` }, copy.notes) : null,
    h(OwnerDiscogs, { site, label: 'Who you’re trading with' }));
}

// Figma `offer target`: the record the offer is for
function OfferTarget({ product, url, label = 'You want' }) {
  const { release, copy } = product;
  const grades = [grading(copy), coverGrading(copy)].filter(Boolean).join(' · ');
  return h('div', { className: 'offer-target' },
    release.cover ? h('img', { className: 'offer-target__image', src: url(release.cover), alt: '', width: 80, height: 80 }) : null,
    h('div', { className: 'offer-target__text' },
      h('p', { className: 'offer-target__label body-small' }, label),
      h('p', { className: 'body-large' }, productName(release)),
      h('p', { className: 'body-small' }, [releaseInfo(release), grades].filter(Boolean).join(' · ')),
      h('a', { className: 'trade-link body-small', href: productHref(product, url) }, 'Back to the record')));
}

// Figma `offered record`: one record of the offer. `n` = its number; the first one has no Remove.
// scripts/site.js clones the template for "Add another record" and renumbers.
// "Which record" (Figma `which record`, decision 0069): with site.json → trade.searchEndpoint set, scripts/site.js turns
// the field into a Discogs release search (suggestions while typing, a pasted release link resolves to its release);
// without it, or if Discogs fails, it stays a plain text field. The release id travels in the hidden `release` input.
function OfferedRecord({ n, search }) {
  const gradeOptions = GRADES.map((g) => h('option', { key: g, value: g }, g));
  return h('fieldset', { className: 'offered-record', 'data-offer-record': '' },
    h('div', { className: 'offered-record__head' },
      h('legend', { className: 'label-small', 'data-offer-record-title': '' }, `Record ${n}`),
      h('button', { type: 'button', className: 'offered-record__remove body-small', hidden: n === 1, 'data-offer-record-remove': '' }, 'Remove')),
    h('div', { className: 'release-picker', 'data-release-picker': '' },
      h(Z.Input, { label: 'Which record', name: 'record', required: true, autoComplete: 'off', 'data-release-input': '',
        placeholder: search ? 'Search Discogs or paste a release link' : 'Discogs link, or artist \u2013 title' }),
      h('div', { className: 'release-picker__chosen', hidden: true, 'data-release-chosen': '' }),
      h('input', { type: 'hidden', name: 'release', 'data-release-id': '' })),
    h('div', { className: 'offered-record__grades' },
      h(Z.Input, { variant: 'select', label: 'Record condition', name: 'media', required: true, placeholder: 'Grade' }, gradeOptions),
      h(Z.Input, { variant: 'select', label: 'Cover condition', name: 'sleeve', placeholder: 'Grade' }, gradeOptions.concat(h('option', { key: 'none', value: 'none' }, 'No cover')))));
}

// Gio 2026-11-13: we talk by email (his favourite); the profiles only prove who the trader is (decision 0070)

// Where the trader sends the code: a new message to Gio on each network (site.json → owner)
function verifyLinks(owner) {
  const o = owner || {};
  return [
    { key: 'discogs', label: 'Send it on Discogs', href: (o.discogs || {}).message },
    { key: 'instagram', label: 'Send it on Instagram', href: (o.instagram || {}).message },
    { key: 'facebook', label: 'Send it on Facebook', href: (o.facebook || {}).message },
  ].filter((v) => v.href);
}

function Offer({ product, site, url }) {
  const owner = site.owner || {};
  const days = (site.trade || {}).replyDays || 3;
  const search = (site.trade || {}).searchEndpoint || '';
  return h('div', { className: 'zz-page' },
    h(SiteHeader, { site, url, section: 'trade' }),
    h('main', { className: 'trade-content', 'data-offer-page': '' },
      h('h1', { className: 'trade-content__title body-large', 'data-offer-title': '' }, 'Make an offer'),
      h('div', { className: 'trade-col trade-col--1' }, h(Z.Divider), h(OfferTarget, { product, url })),
      h('form', { className: 'trade-form', noValidate: true, 'data-offer-form': '', 'data-listing-slug': product.listing.slug,
        'data-endpoint': (site.trade || {}).offerEndpoint || '', 'data-search-endpoint': search },
        h('div', { className: 'trade-col trade-col--2' }, h(Z.Divider),
          h('div', { className: 'offer-records', 'data-offer-records': '' }, h(OfferedRecord, { n: 1, search })),
          h('template', { 'data-offer-record-template': '' }, h(OfferedRecord, { n: 2, search })),
          h(Z.Button, { type: 'button', hierarchy: 'secondary', className: 'trade-form__add', 'data-offer-add': '' }, 'Add another record'),
          h(Z.Input, { variant: 'text-area', label: 'Your pitch', optional: true, name: 'pitch', maxLength: 2000,
            placeholder: 'Why should I take your record? Extras, a cash top-up, what makes it special…' })),
        // Figma `contact block` → "Introduce yourself" (Gio 2026-11-12/13): the trader has to earn trust. Discogs is
        // required, plus Instagram or Facebook (checked by site.js and the function); after sending, the trader proves
        // both profiles are theirs by sending Gio a code from each (decision 0070)
        h('div', { className: 'trade-col trade-col--3 trade-form__intro', role: 'group', 'aria-labelledby': 'offer-intro-title' }, h(Z.Divider),
          h('h2', { id: 'offer-intro-title', className: 'label-small' }, 'Introduce yourself'),
          h('p', { className: 'body-small' }, 'I don\u2019t trade with strangers. Tell me who you are and where I can see your records and your trades: that\u2019s how I learn to trust you.'),
          h(Z.Input, { variant: 'text-area', label: 'About you', name: 'about', required: true, maxLength: 2000,
            placeholder: 'Who you are, what you collect, trades you\u2019ve done\u2026' }),
          h(Z.Input, { label: 'Discogs username', name: 'discogs', required: true, autoComplete: 'off', placeholder: 'username' }),
          h(Z.Input, { label: 'Instagram', name: 'instagram', autoComplete: 'off', placeholder: '@username', 'data-offer-social': '' }),
          h(Z.Input, { label: 'Facebook', name: 'facebook', autoComplete: 'off', placeholder: 'Profile link or username', 'data-offer-social': '',
            supportText: 'Instagram or Facebook, at least one. I look at your profiles before answering.' }),
          h(Z.Input, { label: 'Email', name: 'email', type: 'email', required: true, autoComplete: 'email', placeholder: 'you@example.com',
            supportText: 'This is where I answer you.' }),
          h(Z.Checkbox, { name: 'inPerson', value: 'yes', label: 'I\u2019d rather meet in person' }),
          // honeypot: hidden from people, bots fill it (the function drops those offers)
          h('div', { className: 'zz-visually-hidden', 'aria-hidden': 'true' },
            h('label', null, 'Website', h('input', { type: 'text', name: 'website', tabIndex: -1, autoComplete: 'off' }))),
          h('p', { className: 'body-small' }, 'Nothing is agreed until we both say yes. How, when and who ships, we work out together.'),
          h('p', { className: 'trade-form__error body-small', role: 'alert', hidden: true, 'data-offer-error': '' }),
          h(Z.Button, { type: 'submit', hierarchy: 'primary', className: 'trade-form__send', 'data-offer-send': '' }, 'Send offer'))),
      // Figma `offer sent`: shown by site.js after a successful send. First the proof (decision 0070): the code the
      // function made, to send from the trader's Discogs and from their Instagram or Facebook; then the usual note.
      h('div', { className: 'trade-col trade-col--2 trade-sent', hidden: true, 'data-offer-sent': '' }, h(Z.Divider),
        h('h2', { className: 'label-small' }, 'One last step: show me it\u2019s you'),
        h('p', { className: 'body-medium' }, 'Send me this code from your Discogs and from your Instagram or Facebook. Until it reaches me from both, I can\u2019t know the offer is really yours.'),
        h('p', { className: 'trade-sent__code body-extra-large', 'data-offer-code': '' }),
        h('div', { className: 'trade-sent__verify' },
          verifyLinks(owner).map((v) => h(Z.Button, { key: v.key, hierarchy: 'secondary', href: v.href, target: '_blank', rel: 'noopener',
            hidden: v.key !== 'discogs', 'data-verify': v.key }, v.label, h('span', { 'aria-hidden': 'true' }, ' \u2197'),
            h('span', { className: 'zz-visually-hidden' }, ' (opens in a new tab)')))),
        h('p', { className: 'body-medium' }, 'Then I read your offer myself and answer you by email within ', String(days),
          ' days. If it\u2019s a yes, we work out the details together.'),
        h('p', { className: 'trade-sent__signature body-small' }, `— ${owner.name || ''}`),
        h(Z.Button, { hierarchy: 'secondary', href: url('/trade/') }, 'More records for trade'))));
}

// Gio 2026-11-12: generic, no shipping rule: trust comes from introductions and the conversation
const STEPS = [
  ['You make an offer', 'Pick the records you\u2019d give and tell me why I should take them. No account needed.'],
  ['You introduce yourself', 'Who you are, your Discogs and your Instagram or Facebook: there I can see who we know in common. I don\u2019t trade with strangers: convince me I can trust you.'],
  ['You show me it\u2019s you', 'After sending, you get a code: send it to me from your Discogs and from your Instagram or Facebook. That\u2019s how I know the profiles are yours.'],
  ['We talk', 'I answer you personally by email within 3 days. You can look at my profiles too.'],
  ['We find an agreement', 'Videos of the records, how and when we swap, or we meet in person. Nothing is agreed until we both say yes.'],
  ['We trade', 'And if it went well, we both say so where we talked.']
];
function HowTrading({ site, url }) {
  return h('div', { className: 'zz-page' },
    h(SiteHeader, { site, url, section: 'trade' }),
    h('main', { className: 'trade-content' },
      h('h1', { className: 'trade-content__title body-large' }, 'How trading works'),
      h('div', { className: 'trade-col trade-col--steps' }, h(Z.Divider),
        h('ol', { className: 'trade-steps' }, STEPS.map(([t, b], i) => h(Z.TradeStep, { key: i, number: i + 1, title: t }, b)))),
      h('div', { className: 'trade-col trade-col--3' }, h(Z.Divider),
        h(OwnerDiscogs, { site, label: 'Who you’re trading with' }),
        h(Z.Button, { hierarchy: 'secondary', href: url('/about/') }, 'About me'),
        h(Z.Button, { hierarchy: 'secondary', href: url('/trade/') }, 'Records for trade'))));
}

function About({ site, url }) {
  const o = site.owner || {};
  return h('div', { className: 'zz-page' },
    h(SiteHeader, { site, url, current: 'about' }),
    h('main', { className: 'trade-content' },
      h('h1', { className: 'trade-content__title body-large' }, 'About'),
      h('div', { className: 'trade-col trade-col--1' }, h(Z.Divider),
        h('div', { className: 'about-intro' },
          h('h2', { className: 'body-extra-large body-large--mobile' }, o.djName),
          h('p', { className: 'body-medium' }, o.bio),
          h('div', { className: 'about-intro__links' }, (o.links || []).map((l) => h(Z.Button, { key: l.href + l.label, hierarchy: 'secondary', href: l.href,
            target: '_blank', rel: 'noopener' }, l.label, h('span', { 'aria-hidden': 'true' }, ' ↗'), h('span', { className: 'zz-visually-hidden' }, ' (opens in a new tab)')))))),
      // Gio 2026-11-12: no gigs anywhere; the Discogs card moves up to the second column
      h('div', { className: 'trade-col trade-col--2' }, h(Z.Divider), h(OwnerDiscogs, { site }))));
}

module.exports = { TradeActions, Offer, HowTrading, About, offerHref };
