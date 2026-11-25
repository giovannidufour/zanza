/* packages/content/content.js — the texts Gio edits in the admin (page Content, #content; decision 0106).
   ONE description of every editable block, for the two places that need it: the admin (the Content list and its
   editors) and the shop build (apps/storefront/build.js, which puts the texts into the pages). No dependencies, no DOM.
   CommonJS module (builds) and classic script (window.HighmuzikContent, the admin: apps/admin/build.js serialises the
   blocks and their defaults into it).

   Model (public.site_texts, migration 0025): one row per block, `key` + `value` (an object of the block's fields).
   A block or a field that was never saved = its default, i.e. the text in the repo today (site.json → owner, the legal
   Markdown in apps/storefront/content/legal/, the constants below), so nothing changes until Gio saves.

   What is editable: texts in Gio's own voice. Interface text (buttons, labels, errors, empty states, the grading scale)
   stays in code (decision 0106).

   Field kinds: text · textarea (empty line = new paragraph) · number · links ([{ label, href }]) ·
   sections ([{ heading, text }], a page in the order it is shown; heading '' = text before the first heading) ·
   steps ([{ title, text }]).
   Inside a page section: **bold**, [link](/path or https://…), lines starting with "- " = a list. Inside any text:
   {{#trade}}…{{/trade}} = only while trade is on (decision 0102), {{key}} = a value the shop fills in (KNOWN_KEYS),
   [[p:…]] = a value still to confirm.
   `path`: the shop page that shows the block (View on shop). `shows`: 'identity-on' | 'identity-off' | 'trade' = when the shop shows the block (Settings → Who I am / Trade). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HighmuzikContent = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var GROUPS = [
    { id: 'about', title: 'About you', help: 'Who runs the shop. Settings → “Show who I am” picks which of the two the shop shows.' },
    { id: 'pages', title: 'Pages', help: 'Longer pages, edited section by section in the order of the page.' },
    { id: 'short', title: 'Short texts', help: 'The lines you say in first person on the shop, grouped by page. Buttons, labels and error messages stay as they are.' }
  ];

  // Today's texts in the page code (apps/storefront/pages/*.js read them from here now)
  var STEPS = [
    ['You make an offer', 'Pick the records you’d give and tell me why I should take them. No account needed.'],
    ['You introduce yourself', 'Who you are, your Discogs and your Instagram or Facebook: there I can see who we know in common. I don’t trade with strangers: convince me I can trust you.'],
    ['You show me it’s you', 'After sending, you get our password, a couple of words: send them to me from your Discogs and from your Instagram or Facebook. That’s how I know the profiles are yours.'],
    ['We talk', 'I answer you personally by email within 3 days. You can look at my profiles too.'],
    ['We find an agreement', 'Videos of the records, how and when we swap, or we meet in person. Nothing is agreed until we both say yes.'],
    ['We trade', 'And if it went well, we both say so where we talked.']
  ];

  var BLOCKS = [
    { key: 'profile', path: '/about/',  group: 'about', title: 'Profile', shows: 'identity-on',
      where: 'About · the About box on the home · trade pages · footer',
      fields: [
        { name: 'name', kind: 'text', label: 'Name', help: 'Signs your notes on trade records and the offer page.' },
        { name: 'djName', kind: 'text', label: 'DJ name', help: 'The name at the top of the About page.' },
        { name: 'bio', kind: 'textarea', label: 'Bio', help: 'About page and the About box on the home. An empty line starts a new paragraph.' },
        { name: 'links', kind: 'links', label: 'Links', help: 'Buttons on the About page, in this order.' },
        { name: 'discogs', kind: 'text', label: 'Discogs username', section: 'Profiles',
          sectionHelp: 'Your Discogs card, the footer, and where traders send you the password. Message links are made from these.' },
        { name: 'discogsStats', kind: 'text', label: 'Discogs card line', section: 'Profiles' },
        { name: 'instagram', kind: 'text', label: 'Instagram username', section: 'Profiles' },
        { name: 'facebook', kind: 'text', label: 'Facebook profile link', section: 'Profiles', help: 'Only for the verification button of offers: never shown on About.' }
      ] },
    { key: 'store_profile', path: '/about/',  group: 'about', title: 'Store profile', shows: 'identity-off',
      where: 'About · the About box on the home · footer',
      fields: [
        { name: 'about', kind: 'textarea', label: 'About the shop', help: 'About page and the About box on the home. No names, no personal profiles. An empty line starts a new paragraph.' },
        { name: 'links', kind: 'links', label: 'Links', help: 'The shop’s own accounts, if any. Your personal ones stay in Profile.' }
      ] },
    { key: 'page.shipping', path: '/shipping/',  group: 'pages', title: 'Shipping', page: 'shipping', where: '/shipping/ · linked from the footer and the Bag',
      fields: [{ name: 'sections', kind: 'sections', label: 'Sections' }] },
    { key: 'page.terms', path: '/terms/',  group: 'pages', title: 'Terms', page: 'terms', where: '/terms/ · linked from the footer',
      fields: [{ name: 'sections', kind: 'sections', label: 'Sections' }] },
    { key: 'page.privacy', path: '/privacy/',  group: 'pages', title: 'Privacy', page: 'privacy', where: '/privacy/ · linked from the footer and the forms',
      fields: [{ name: 'sections', kind: 'sections', label: 'Sections' }] },
    { key: 'page.how_trading', path: '/how-trading-works/',  group: 'pages', title: 'How trading works', shows: 'trade', where: '/how-trading-works/',
      fields: [{ name: 'steps', kind: 'steps', label: 'Steps', default: STEPS.map(function (s) { return { title: s[0], text: s[1] }; }) }] },
    { key: 'short.home', path: '/',  group: 'short', title: 'Home', where: 'Home · the welcome line at the top',
      fields: [
        { name: 'intro', kind: 'textarea', label: 'Welcome line', help: 'The link “Subscribe to newsletter” follows it.', default: 'Welcome! This space is for record sales from my personal collection. Reggae and affiliate music will be regularly listed, watch this space for shop & discovery.' }
      ] },
    { key: 'short.contact', path: '/contact/',  group: 'short', title: 'Contact', where: '/contact/',
      fields: [
        { name: 'intro', kind: 'textarea', label: 'Intro', default: 'Questions about a record, an order{{#trade}} or a trade{{/trade}}? Write to me by email or with the form, and I answer by email.' },
        { name: 'sent', kind: 'textarea', label: 'Message sent', help: 'Shown in place of the form after sending.', default: 'Thanks, your message is on its way. I answer by email, usually within a few days.' }
      ] },
    { key: 'short.order', path: '/checkout/thanks/',  group: 'short', title: 'Order confirmed', where: '/checkout/thanks/ · after paying',
      fields: [
        { name: 'note', kind: 'textarea', label: 'Note', help: 'Under “Your order is confirmed”.', default: 'I pack every record by hand and post orders at least once a week, usually on Wednesday. You get the tracking number by email when it ships.' }
      ] },
    { key: 'short.trade', path: '/trade/',  group: 'short', title: 'Trade: record page and offer', shows: 'trade', where: 'Records for trade · Make an offer',
      fields: [
        { name: 'pitch', kind: 'textarea', label: 'Under “Make an offer”', help: 'On every record for trade.', default: 'Not for sale. Convince me with a trade: show me what you’ve got, and who you are.' },
        { name: 'reserved', kind: 'textarea', label: 'Record reserved', default: 'I’ve accepted an offer for this record. If it falls through, it’s open again.' },
        { name: 'traded', kind: 'textarea', label: 'Record traded', default: 'This one found a new home.' },
        { name: 'introduce', kind: 'textarea', label: 'Introduce yourself', help: 'Offer page, above the trader’s details.', default: 'I don’t trade with strangers. Tell me who you are and where I can see your records and your trades: that’s how I learn to trust you.' },
        { name: 'agreement', kind: 'textarea', label: 'Above “Send offer”', default: 'Nothing is agreed until we both say yes. How, when and who ships, we work out together.' },
        { name: 'replyDays', kind: 'number', label: 'Reply within (days)', help: 'After sending: “I answer you by email within N days.”', default: 3 }
      ] }
  ];

  // {{key}} values the shop fills in (apps/storefront/pages/legal.js); anything else in braces is refused on save
  var KNOWN_KEYS = ['legal.name', 'legal.email', 'legal.updated', 'storeName', 'shipping.countries'];
  var FLAGS = ['trade', 'wantlist'];

  function blockOf(key) { return BLOCKS.filter(function (b) { return b.key === key; })[0] || null; }

  // ── pages: Markdown (content/legal/*.md, the legal.js subset) ⇄ sections ──
  // "# Title" (fixed, not editable) · "## Heading" starts a section · the blocks under it = its text
  function sectionsFromMarkdown(md) {
    var blocks = String(md || '').replace(/\r/g, '').trim().split(/\n\s*\n/);
    var title = blocks[0] && blocks[0].indexOf('# ') === 0 ? blocks.shift().slice(2).trim() : '';
    var sections = [{ heading: '', parts: [] }];
    blocks.forEach(function (b) {
      if (b.indexOf('## ') === 0) {
        var lines = b.split('\n');
        sections.push({ heading: lines[0].slice(3).trim(), parts: lines.length > 1 ? [lines.slice(1).join('\n')] : [] });
      } else sections[sections.length - 1].parts.push(b);
    });
    return { title: title, sections: sections.filter(function (s) { return s.heading || s.parts.length; })
      .map(function (s) { return { heading: s.heading, text: s.parts.join('\n\n') }; }) };
  }
  function markdownFromSections(title, sections) {
    var out = title ? ['# ' + title] : [];
    (sections || []).forEach(function (s) {
      var text = String(s.text || '').replace(/\r/g, '').trim(), heading = String(s.heading || '').replace(/\s+/g, ' ').trim();
      if (heading) out.push('## ' + heading);
      if (text) out.push(text);
    });
    return out.join('\n\n') + '\n';
  }

  // defaults = today's texts. ctx: { owner: site.json → owner, comingSoon: site.json → comingSoon,
  // legal: { shipping: '<markdown>', … } }
  function defaults(ctx) {
    ctx = ctx || {};
    var o = ctx.owner || {};
    var out = {};
    BLOCKS.forEach(function (b) {
      var v = {};
      b.fields.forEach(function (f) { if (f.default !== undefined) v[f.name] = clone(f.default); });
      if (b.page) v.sections = sectionsFromMarkdown((ctx.legal || {})[b.page]).sections;
      out[b.key] = v;
    });
    out.profile = {
      name: o.name || '', djName: o.djName || '', bio: o.bio || '',
      links: (o.links || []).map(function (l) { return { label: l.label, href: l.href }; }),
      discogs: (o.discogs || {}).username || '', discogsStats: (o.discogs || {}).stats || '',
      instagram: (o.instagram || {}).handle || '', facebook: (o.facebook || {}).href || ''
    };
    out.store_profile = { about: 'Reggae and dancehall records from my crates.', links: [] };
    return out;
  }
  // page titles (fixed): from the Markdown
  function pageTitles(legal) {
    var t = {};
    BLOCKS.forEach(function (b) { if (b.page) t[b.page] = sectionsFromMarkdown((legal || {})[b.page]).title || b.title; });
    return t;
  }

  // the saved rows over the defaults, field by field: { key: value }, plus { key: updated_at } in `updated`
  function resolve(defs, rows) {
    var texts = {}, updated = {};
    Object.keys(defs).forEach(function (k) { texts[k] = clone(defs[k]); });
    (rows || []).forEach(function (r) {
      var b = blockOf(r.key);
      if (!b || !r.value || typeof r.value !== 'object') return;   // an old or unknown key: ignored
      b.fields.forEach(function (f) { if (r.value[f.name] !== undefined && r.value[f.name] !== null) texts[r.key][f.name] = clone(r.value[f.name]); });
      updated[r.key] = r.updated_at || null;
    });
    return { texts: texts, updated: updated };
  }

  // Profile → the `owner` object the pages have always read (site.json shape), message links derived
  function ownerFromProfile(p) {
    p = p || {};
    var dg = String(p.discogs || '').trim(), ig = String(p.instagram || '').trim().replace(/^@/, ''), fb = String(p.facebook || '').trim();
    var fbSlug = (fb.match(/facebook\.com\/([^/?#]+)/) || [])[1] || '';
    return {
      name: p.name || '', djName: p.djName || '', bio: p.bio || '',
      links: (p.links || []).filter(function (l) { return l && l.label && l.href; }),
      discogs: dg ? { username: dg, href: 'https://www.discogs.com/user/' + dg, stats: p.discogsStats || '', message: 'https://www.discogs.com/messages/compose?to=' + dg } : {},
      instagram: ig ? { handle: ig, href: 'https://www.instagram.com/' + ig + '/', message: 'https://ig.me/m/' + ig } : {},
      facebook: fb ? { href: fb, message: fbSlug ? 'https://m.me/' + fbSlug : '' } : {}
    };
  }

  // {{#trade}}…{{/trade}}: kept (markers removed) while on, dropped while off
  function applyFlags(text, flags) {
    return String(text || '').replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, function (m, flag, inner) {
      return flags && flags[flag] === false ? '' : inner;
    });
  }
  // paragraphs of a textarea: an empty line = a new paragraph
  function paragraphs(text) {
    return String(text || '').replace(/\r/g, '').split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
  }

  // what blocks a Save (shown inline, nothing saved): unknown {{key}}, unbalanced {{#trade}}, empty required parts
  function problems(key, value) {
    var b = blockOf(key), out = [];
    if (!b) return ['Unknown text.'];
    function checkText(where, t) {
      t = String(t || '');
      var opens = (t.match(/\{\{#(\w+)\}\}/g) || []).length, closes = (t.match(/\{\{\/(\w+)\}\}/g) || []).length;
      if (opens !== closes) out.push(where + ': every {{#trade}} needs its {{/trade}}.');
      (t.match(/\{\{#(\w+)\}\}/g) || []).forEach(function (m) { var f = m.slice(3, -2); if (FLAGS.indexOf(f) < 0) out.push(where + ': {{#' + f + '}} is not known.'); });
      (t.match(/\{\{([\w.]+)\}\}/g) || []).forEach(function (m) { var k = m.slice(2, -2); if (KNOWN_KEYS.indexOf(k) < 0) out.push(where + ': ' + m + ' is not a value the shop knows.'); });
    }
    b.fields.forEach(function (f) {
      var v = value[f.name];
      if (f.kind === 'text' || f.kind === 'textarea') checkText(f.label, v);
      if (f.kind === 'number' && !(Number.isInteger(v) && v > 0)) out.push(f.label + ': a whole number of days.');
      if (f.kind === 'links') (v || []).forEach(function (l, i) {
        if (!String(l.label || '').trim() || !/^https?:\/\/\S+$/.test(String(l.href || '').trim())) out.push('Link ' + (i + 1) + ': a label and a link starting with https://.');
      });
      if (f.kind === 'sections') (v || []).forEach(function (s, i) {
        checkText('Section ' + (i + 1), s.text);
        if (!String(s.text || '').trim()) out.push('Section ' + (i + 1) + ': the text is empty.');
        // only the first section may have no heading (the text above the first heading); a later one would join the one before
        if (i > 0 && !String(s.heading || '').trim()) out.push('Section ' + (i + 1) + ': a heading.');
        if (/^#/.test(String(s.text || '').trim()) || /\n\s*#/.test(String(s.text || ''))) out.push('Section ' + (i + 1) + ': start a new section instead of writing # in the text.');
      });
      if (f.kind === 'steps') (v || []).forEach(function (s, i) {
        checkText('Step ' + (i + 1), s.text);
        if (!String(s.title || '').trim() || !String(s.text || '').trim()) out.push('Step ' + (i + 1) + ': a title and a text.');
      });
    });
    return out;
  }

  function clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }

  return { GROUPS: GROUPS, BLOCKS: BLOCKS, KNOWN_KEYS: KNOWN_KEYS, blockOf: blockOf, defaults: defaults, pageTitles: pageTitles,
    resolve: resolve, ownerFromProfile: ownerFromProfile, applyFlags: applyFlags, paragraphs: paragraphs, problems: problems,
    sectionsFromMarkdown: sectionsFromMarkdown, markdownFromSections: markdownFromSections };
});
