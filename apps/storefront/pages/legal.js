/* apps/storefront/pages/legal.js — the legal pages (decision 0079, Figma page `Legal`): Impressum, Privacy, Terms,
   Withdrawal, and Shipping (the footer's Info link). The text lives in content/legal/<page>.md, so it can be edited (or
   replaced by a lawyer's / a generator's text) without touching code. Pure functions: data in, React tree out.
   The Markdown is a small, closed subset (no HTML passes through):
   - `# Title` (first line, the page h1) · `## Heading` · blank line = new block
   - a block of `- ` lines = bullet list, `1. ` lines = numbered list; any other block = a paragraph, its lines kept as
     lines (addresses)
   - inline: **bold**, [text](/path or https://…)
   - `{{legal.x}}` / `{{storeName}}` = a value from site.json; empty → its bracketed placeholder (PLACEHOLDERS below)
   - `{{shipping.countries}}` (alone in a block) = the served countries by zone, from the shipping config (decision 0075)
   - `[[TO FILL: …]]` = text Gio still has to write: shown as "[TO FILL: …]"
   - `[[p:value]]` = a PLACEHOLDER value chosen by Claude (Gio 2026-11-14: "metti dei placeholder"): shown as plain text,
     listed by the build and in _context/provisional-names.md → Pagine legali, to be confirmed or replaced by Gio */
'use strict';
const fs = require('fs');
const path = require('path');
const React = require('react');
const Z = require('../../../packages/ui/components.js');
const h = React.createElement;
const { SiteHeader } = require('./shell.js');

const PAGES = ['impressum', 'privacy', 'terms', 'withdrawal', 'shipping'];
const PLACEHOLDERS = {
  'legal.name': '[Your full name]', 'legal.street': '[Street and number]', 'legal.postcode': '[Postcode]',
  'legal.city': '[City]', 'legal.country': '[Country]', 'legal.email': '[Contact email]', 'legal.phone': '[Phone number]',
  'legal.vat': '[VAT line: your VAT ID, or the small business note (§ 19 UStG)]', 'legal.updated': '[Date]'
};

const read = (page) => fs.readFileSync(path.join(__dirname, '../content/legal', `${page}.md`), 'utf8');
const get = (obj, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

// {{key}} → site.json value or placeholder; collects what is still missing (the build prints it)
function fill(text, site, missing) {
  return text.replace(/\{\{([\w.]+)\}\}/g, (m, key) => {
    if (key === 'shipping.countries') return m;   // a block, rendered by legalBody
    const v = get(site, key);
    if (v != null && String(v).trim() !== '') return String(v);
    missing.add(PLACEHOLDERS[key] || `[${key}]`);
    return PLACEHOLDERS[key] || `[${key}]`;
  }).replace(/\[\[p:([^\]]+)\]\]/g, (m, t) => { missing.add(`placeholder "${t}"`); return t; })
    .replace(/\[\[([^\]]+)\]\]/g, (m, t) => { missing.add(`[${t}]`); return `[${t}]`; });
}

// inline: **bold** and [text](href); a site path goes through url() (basePath)
function inline(text, url) {
  const out = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(h('strong', { key: i++ }, m[1]));
    else {
      const external = /^https?:\/\//.test(m[3]);
      out.push(h('a', { key: i++, href: external ? m[3] : url(m[3]), ...(external ? { rel: 'noopener' } : {}) }, m[2]));
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// the served countries, one line per zone ("EU: Austria, Belgium, …"); countries = data/shipping.js countries()
function countryList(shipping, countries) {
  const served = new Set(countries.map((c) => c.code));
  const names = new Map(countries.map((c) => [c.code, c.name]));
  const zones = ((shipping && shipping.zones) || [])
    .map((z) => ({ name: z.name, list: (z.countries || []).map((c) => String(c).toUpperCase()).filter((c) => served.has(c)) }))
    .filter((z) => z.list.length);
  if (!zones.length) return h('p', { className: 'body-medium' }, 'The countries are shown in the bag, under “Ship to”.');
  return h('ul', { className: 'legal-text__list body-medium' }, zones.map((z) => h('li', { key: z.name },
    h('strong', null, z.name), ': ', z.list.map((c) => names.get(c)).sort((a, b) => a.localeCompare(b, 'en')).join(', '))));
}

// Markdown (subset above) → { title, sections: [{ heading, blocks }] }; text before the first ## = an intro section
function parse(md) {
  const blocks = md.replace(/\r/g, '').trim().split(/\n\s*\n/);
  const title = blocks[0].startsWith('# ') ? blocks.shift().slice(2).trim() : '';
  const sections = [{ heading: null, blocks: [] }];
  for (const b of blocks) {
    if (b.startsWith('## ')) {
      const [head, ...rest] = b.split('\n');
      sections.push({ heading: head.slice(3).trim(), blocks: rest.length ? [rest.join('\n')] : [] });
    } else sections[sections.length - 1].blocks.push(b);
  }
  return { title, sections: sections.filter((s) => s.heading || s.blocks.length) };
}

function block(b, key, { url, shipping, countries }) {
  const lines = b.split('\n');
  if (b.trim() === '{{shipping.countries}}') return h(React.Fragment, { key }, countryList(shipping, countries));
  if (lines.every((l) => /^- /.test(l))) return h('ul', { key, className: 'legal-text__list body-medium' },
    lines.map((l, i) => h('li', { key: i }, inline(l.slice(2), url))));
  if (lines.every((l) => /^\d+\. /.test(l))) return h('ol', { key, className: 'legal-text__list body-medium' },
    lines.map((l, i) => h('li', { key: i }, inline(l.replace(/^\d+\. /, ''), url))));
  return h('p', { key, className: 'body-medium' },
    lines.flatMap((l, i) => (i ? [h('br', { key: `br${i}` }), ...inline(l, url)] : inline(l, url))));
}

// Figma `legal section`: heading (label-small) + text; Figma `legal content`: title, divider, sections
function legalPage(page, { site, url, shipping, countries }) {
  const missing = new Set();
  const { title, sections } = parse(fill(read(page), site, missing));
  const body = h('div', { className: 'zz-page' },
    h(SiteHeader, { site, url, current: page }),
    h('main', { className: 'legal-content' },
      h('h1', { className: 'legal-content__title body-large' }, title),
      h('div', { className: 'legal-text' }, h(Z.Divider),
        sections.map((s, i) => h('section', { key: i, className: 'legal-text__section', 'aria-labelledby': s.heading ? `legal-${i}` : undefined },
          s.heading ? h('h2', { id: `legal-${i}`, className: 'label-small' }, s.heading) : null,
          s.blocks.map((b, j) => block(b, j, { url, shipping, countries })))))));
  return { title, body, missing: [...missing] };
}

module.exports = { PAGES, legalPage, parse };
