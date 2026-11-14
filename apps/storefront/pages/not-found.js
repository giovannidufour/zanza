/* apps/storefront/pages/not-found.js — the 404 page (decision 0084). No Figma frame yet (design/open.md): it borrows
   the layout of the legal pages (title, divider, text) and one secondary button back to the records. */
'use strict';
const React = require('react');
const Z = require('../../../packages/ui/components.js');
const { SiteHeader } = require('./shell.js');
const h = React.createElement;

function NotFound({ site, url }) {
  return h('div', { className: 'zz-page' },
    h(SiteHeader, { site, url }),
    h('main', { className: 'legal-content' },
      h('h1', { className: 'legal-content__title body-large' }, 'Page not found'),
      h('div', { className: 'legal-text' }, h(Z.Divider),
        h('section', { className: 'legal-text__section' },
          h('p', { className: 'body-medium' }, 'This page doesn’t exist, or the record has gone.'),
          h(Z.Button, { hierarchy: 'secondary', href: url('/sale/') }, 'Records for sale')))));
}

module.exports = { NotFound };
