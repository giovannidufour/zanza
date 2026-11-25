/* apps/storefront/pages/contact.js — /contact/ (decision 0093, Figma page `Legal` → `contact form`): Gio sells privately,
   with no address or phone on the site: only his email and this form. Same layout as the legal pages (legal.css).
   scripts/site.js validates and posts the form as JSON to the Supabase function `contact` (site.json → contact.endpoint);
   empty endpoint = the form says it is not switched on yet and points to the email. Nothing is stored. */
'use strict';
const React = require('react');
const Z = require('../../../packages/ui/components.js');
const h = React.createElement;
const { SiteHeader, textOf, Paragraphs } = require('./shell.js');

function Contact({ site, url }) {
  const email = (site.legal || {}).email || '';
  const endpoint = (site.contact || {}).endpoint || '';
  return h('div', { className: 'hm-page' },
    h(SiteHeader, { site, url, current: 'contact' }),
    h('main', { className: 'legal-content' },
      h('h1', { className: 'legal-content__title body-large', 'data-contact-title': '' }, 'Contact'),
      h('div', { className: 'legal-text' }, h(Z.Divider),
        h('section', { className: 'legal-text__section' },
          h(Paragraphs, { text: textOf(site, 'short.contact', 'intro') }),   // admin → Content → Contact (decision 0106)
          h('p', { className: 'body-medium' }, 'Email: ', email ? h('a', { href: `mailto:${email}` }, email) : '[Contact email]')),
        // Figma `contact form`: Name (optional), Email, Message, Send; error line above the button
        h('form', { className: 'contact-form', noValidate: true, 'data-contact-form': '', 'data-endpoint': endpoint },
          h(Z.Input, { label: 'Name', optional: true, name: 'name', autoComplete: 'name', maxLength: 100 }),
          h(Z.Input, { label: 'Email', name: 'email', type: 'email', required: true, autoComplete: 'email', placeholder: 'you@example.com',
            supportText: 'This is where I answer you.' }),
          h(Z.Input, { variant: 'text-area', label: 'Message', name: 'message', required: true, maxLength: 4000 }),
          // honeypot: hidden from people, bots fill it (the function drops those messages)
          h('div', { className: 'hm-visually-hidden', 'aria-hidden': 'true' },
            h('label', null, 'Website', h('input', { type: 'text', name: 'website', tabIndex: -1, autoComplete: 'off' }))),
          h('p', { className: 'body-small' }, 'Your message reaches me by email and is not stored on the site. ', h('a', { href: url('/privacy/') }, 'Privacy')),
          h('p', { className: 'contact-form__error body-small', role: 'alert', hidden: true, 'data-contact-error': '' }),
          h(Z.Button, { type: 'submit', hierarchy: 'primary', className: 'contact-form__send', 'data-contact-send': '' }, 'Send')),
        h('section', { className: 'legal-text__section', hidden: true, 'data-contact-sent': '' },
          h(Paragraphs, { text: textOf(site, 'short.contact', 'sent') })))));
}

module.exports = { Contact };
