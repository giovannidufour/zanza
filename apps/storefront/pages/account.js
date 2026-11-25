/* apps/storefront/pages/account.js — the customer account (Figma: page `Account`, 2198:2395; decision 0101).
   Three static pages: /account/ (orders), /account/order/?id=<order id> (one order), /account/details/. Each carries the
   sign-in block and the signed-in block, both hidden: scripts/account.js shows one of them, signs in with an email and a
   6-digit code (Supabase Auth email OTP), reads the orders (public.customer_orders, migration 0022) and fills them in
   from the <template>s below, so the rows and lines come from packages/ui like every other page.
   Guest checkout stays: an account is never required, orders bought with the same email show up on their own.
   Layout (Figma `account content`): 12-col grid, title row 1; sign in cols 1–4; orders and order lines cols 1–8, the
   order aside cols 9–12; details cols 1–6. Mobile: one column. */
'use strict';
const React = require('react');
const Z = require('../../../packages/ui/components.js');
const h = React.createElement;
const { SiteHeader } = require('./shell.js');

const TITLE = { orders: 'Your orders', order: 'Order', details: 'Account details' };

// Figma `account nav`: tabs size extra small as links (each its own URL, aria-current; not ARIA tabs)
function AccountNav({ url, view }) {
  return h(Z.Tabs, { as: 'nav', value: view === 'details' ? 'details' : 'orders', 'aria-label': 'Account', className: 'account-nav' },
    h(Z.Tab, { value: 'orders', size: 'extra-small', href: url('/account/') }, 'Orders'),
    h(Z.Tab, { value: 'details', size: 'extra-small', href: url('/account/details/') }, 'Details'));
}

// Figma: Account - desktop · sign in / · code / · wrong code. Two forms, one shown at a time (scripts/account.js).
// The code request answers the same whether or not the email has orders (no one can test which emails bought here).
function SignIn() {
  return h('section', { className: 'account-signin', 'data-account-signin': '', hidden: true, 'aria-label': 'Sign in' },
    h(Z.Divider),
    h('form', { className: 'account-stack', 'data-account-email-form': '', noValidate: true },
      h('p', { className: 'body-medium' }, 'Sign in with the email you used for your orders. We send you a 6-digit code: no password needed.'),
      h(Z.Input, { id: 'account-email', label: 'Email', type: 'email', name: 'email', autoComplete: 'email', required: true,
        placeholder: 'you@example.com', 'data-account-email-input': '' }),
      h(Z.Button, { hierarchy: 'primary', type: 'submit', className: 'account-fill' }, 'Send code'),
      h('p', { className: 'body-small' }, 'You can always buy without an account. Orders made with the same email show up here.')),
    h('form', { className: 'account-stack', 'data-account-code-form': '', noValidate: true, hidden: true },
      h('p', { className: 'body-medium', 'data-account-code-intro': '', tabIndex: -1 }, 'If this email has orders here, a 6-digit code is on its way to ',
        h('span', { 'data-account-sent-to': '' }), '. It works for 10 minutes.'),
      h(Z.Input, { id: 'account-code', label: 'Code', type: 'text', name: 'code', inputMode: 'numeric', autoComplete: 'one-time-code',
        pattern: '[0-9]*', maxLength: 6, required: true, placeholder: '123456', 'data-account-code-input': '' }),
      h(Z.Button, { hierarchy: 'primary', type: 'submit', className: 'account-fill' }, 'Sign in'),
      h('div', { className: 'account-actions' },
        h(Z.Button, { hierarchy: 'secondary', 'data-account-resend': '' }, 'Send a new code'),
        h(Z.Button, { hierarchy: 'secondary', 'data-account-change-email': '' }, 'Use another email')),
      h('p', { className: 'body-small' }, 'No email? Check your spam folder. You can ask for a new code after 60 seconds.')));
}

// Figma: Account - desktop · orders / · orders · empty
function Orders({ url }) {
  return h(React.Fragment, null,
    h('ul', { className: 'account-list', 'data-account-orders': '' }),
    h('div', { className: 'account-stack', 'data-account-empty': '', hidden: true },
      h(Z.Divider),
      h('p', { className: 'body-medium' }, 'No orders yet. Records you buy with ', h('span', { 'data-account-email-text': '' }),
        ' show up here, also the ones bought without signing in.'),
      h(Z.Button, { hierarchy: 'secondary', href: url('/sale/'), className: 'account-hug' }, 'Browse records for sale')));
}

// Figma: Account - desktop · order detail. Lines in `main`, status / totals / address / help in `order aside`.
function Order({ url }) {
  const block = (name, children) => h('section', { className: `account-aside__block account-aside__${name}`, 'data-account-block': name }, h(Z.Divider), children);
  const row = (key, label) => h('div', { className: 'account-totals__row' },
    h('dt', { className: 'body-medium', 'data-account-label': key }, label), h('dd', { className: 'body-medium', 'data-account-value': key }));
  return h(React.Fragment, null,
    h('div', { className: 'account-order' },
      h(Z.Button, { hierarchy: 'secondary', href: url('/account/'), className: 'account-hug' }, 'All orders'),
      h('div', { className: 'account-order-heading body-large' },
        h('h2', { className: 'body-large', 'data-account-order-title': '' }), h('p', { 'data-account-order-date': '' })),
      h('ul', { className: 'account-list', 'data-account-items': '' })),
    h('aside', { className: 'account-aside', 'data-account-aside': '', 'aria-label': 'Order summary' },
      block('status', [
        h('p', { key: 's', className: 'body-medium', 'data-account-status': '' }),
        h('p', { key: 'd', className: 'body-medium', 'data-account-status-detail': '' })]),
      block('totals', h('dl', { className: 'account-totals' },
        row('subtotal', 'Subtotal'), row('shipping', 'Shipping'), row('total', 'Total paid'))),
      block('address', [
        h('h3', { key: 'l', className: 'body-medium' }, 'Shipping to'),
        h('p', { key: 'a', className: 'body-medium account-address', 'data-account-address': '' })]),
      block('help', [
        h('p', { key: 't', className: 'body-small' }, 'Something wrong with this order? Write to us with the order number.'),
        h(Z.Button, { key: 'b', hierarchy: 'secondary', href: url('/contact/'), className: 'account-hug account-fill--mobile' }, 'Write to us')])));
}

// Figma: Account - desktop · details (+ · delete account dialog). "Change email" is left out: orders are found by
// email, so a new email would lose them (design/open.md).
function Details() {
  const block = (name, children) => h('section', { className: 'account-details__block', 'data-account-block': name }, children);
  return h('div', { className: 'account-details' },
    h(Z.Divider),
    block('email', [
      h('h2', { key: 'l', className: 'body-large' }, 'Email'),
      h('p', { key: 'v', className: 'body-medium', 'data-account-email-text': '' }),
      h('p', { key: 'h', className: 'body-small' }, 'Sign-in codes and order emails go here.')]),
    block('session', [
      h(Z.Divider, { key: 'd' }),
      h('h2', { key: 'l', className: 'body-large' }, 'Signed in on this device'),
      h(Z.Button, { key: 'b', hierarchy: 'secondary', className: 'account-hug account-fill--mobile', 'data-account-sign-out': '' }, 'Sign out')]),
    block('data', [
      h(Z.Divider, { key: 'd' }),
      h('h2', { key: 'l', className: 'body-large' }, 'Your data'),
      h('p', { key: 't', className: 'body-medium' }, 'We keep your email and your orders, with their shipping address. Payments stay with Stripe.'),
      h(Z.Button, { key: 'b', hierarchy: 'secondary', className: 'account-hug account-fill--mobile', 'data-account-download': '' }, 'Download my data')]),
    block('delete', [
      h(Z.Divider, { key: 'd' }),
      h('h2', { key: 'l', className: 'body-large' }, 'Delete account'),
      h('p', { key: 't', className: 'body-medium' }, 'We delete your account and sign you out. Your orders stay in our records, no longer linked to an account.'),
      h(Z.Button, { key: 'b', hierarchy: 'secondary', className: 'account-hug account-fill--mobile', 'data-account-delete': '' }, 'Delete account')]));
}

// the markup scripts/account.js clones: one order row, one order line, one sample button (packages/ui)
function Templates() {
  return h(React.Fragment, null,
    h('template', { 'data-account-row-template': '' },
      h('li', null, h(Z.Divider), h(Z.OrderRow, { href: '#', label: '', image: { src: 'about:blank' }, title: 't', date: 'd', count: 'c', status: 's', total: 'p' }))),
    h('template', { 'data-account-item-template': '' },
      h('li', null, h(Z.Divider), h(Z.OrderItem, { image: { src: 'about:blank' }, title: 't', releaseInfo: 'r', grading: 'g', cover: 'c', conditions: 'n', samples: h('span'), price: 'p', headingLevel: 3 }))),
    h('template', { 'data-account-sample-template': '' }, h(Z.PlayerButton, null, '1')));
}

function Account({ site, url, view }) {
  return h('div', { className: 'hm-page' },
    h(SiteHeader, { site, url, current: 'account' }),
    h('main', { className: `account-content account-content--${view}`, 'data-account-page': view,
        'data-media-base': (site.mediaBaseUrl || '').replace(/\/$/, ''), 'data-base-path': url(''), 'data-shop-name': site.storeName },
      h('h1', { className: 'account-content__title body-large', 'data-account-title': '' }, 'Account'),
      h('p', { className: 'account-content__message body-medium', 'data-account-message': '', role: 'status' }, 'Loading…'),
      h(SignIn),
      h('div', { className: 'account-main', 'data-account-main': '', hidden: true },
        h(AccountNav, { url, view }),
        view === 'orders' ? h(Orders, { url }) : view === 'order' ? h(Order, { url }) : h(Details)),
      h(Templates)),
    view === 'details' ? h(Z.Dialog, {
      open: false, className: 'account-delete', 'data-account-delete-dialog': '', title: 'Delete your account?',
      confirmLabel: 'Delete account', cancelLabel: 'Keep account', onConfirm: () => {}, onCancel: () => {}
    }, 'You will be signed out. Your orders stay in our records, no longer linked to you. This cannot be undone.') : null);
}

module.exports = { Account, TITLE };
