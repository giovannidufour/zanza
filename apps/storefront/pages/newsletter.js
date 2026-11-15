/* apps/storefront/pages/newsletter.js — /newsletter/confirm/, where the link in the confirmation email lands (decision 0103).
   One block of states, shown one at a time by scripts/newsletter.js: pending (confirming), ask (Confirm button, when
   site.json → newsletter.autoConfirm is false), done, expired, error. Used by the shop (build.js, legal page layout) and
   by the coming-soon page (build-coming-soon.js, its own layout): each passes the title and the wrapper. */
'use strict';
const React = require('react');
const Z = require('../../../packages/ui/components.js');
const h = React.createElement;

const title = 'Newsletter';

// signup = where to sign up again (text), contactEmail = the shop address for when it keeps failing
function ConfirmStates({ site, signup, homeHref }) {
  const nl = site.newsletter || {};
  const email = (site.legal || {}).email || '';
  const p = (key, ...children) => h('p', { key, className: 'body-medium' }, ...children);
  const state = (name, hidden, ...children) => h('div', { key: name, 'data-state': name, hidden, className: 'newsletter-confirm__state' }, ...children);
  return h('div', { className: 'newsletter-confirm', 'data-newsletter-confirm': '', 'data-endpoint': nl.endpoint || '', 'data-auto': nl.autoConfirm === false ? 'false' : 'true' },
    state('pending', false, p('a', 'Confirming your subscription…'),
      h('noscript', { key: 'n' }, p('b', 'This page needs JavaScript to confirm your subscription.'))),
    state('ask', true, p('a', 'One last step: confirm that you want the newsletter.'),
      h(Z.Button, { key: 'b', type: 'button', hierarchy: 'primary', 'data-newsletter-confirm-button': '' }, 'Confirm subscription')),
    state('done', true, p('a', 'Thanks! New records will reach your inbox. You can leave anytime with the link at the bottom of every email.'),
      homeHref ? p('b', h('a', { href: homeHref }, 'Back to the shop')) : null),
    state('expired', true, p('a', 'This link has expired or isn’t complete. ', signup, ' and you’ll get a new one.')),
    state('error', true, p('a', 'Your subscription didn’t go through. Open the link from the email again in a minute',
      email ? [', and if it still fails, write to ', h('a', { key: 'm', href: `mailto:${email}` }, email), '.'] : '.')));
}

// the shop's page: header, then the legal pages' layout (legal.css), like /contact/; the footer has the signup form
function ShopConfirm({ site, url }) {
  const { SiteHeader } = require('./shell.js');
  return h('div', { className: 'zz-page' },
    h(SiteHeader, { site, url }),
    h('main', { className: 'legal-content' },
      h('h1', { className: 'legal-content__title body-large', 'data-newsletter-title': '' }, title),
      h('div', { className: 'legal-text' }, h(Z.Divider),
        h('section', { className: 'legal-text__section' },
          h(ConfirmStates, { site, homeHref: url('/'), signup: 'Sign up again with the form at the bottom of the page' })))));
}

module.exports = { title, ConfirmStates, ShopConfirm };
