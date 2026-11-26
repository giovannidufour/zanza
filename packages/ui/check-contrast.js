/* packages/ui/check-contrast.js
   WCAG 2.x contrast of the foreground tokens on the grounds they sit on, in every theme of tokens.json (0197).
   Run: npm run check:contrast
        npm run check:contrast -- --accent=#636ab4 --support-1=#b7ff00   (try a `_config` palette before adopting it)
        add --strict to exit 1 when a pair fails (for CI).
   Text pairs need 4.5:1 (1.4.3), icons / borders / outlines 3:1 (1.4.11). Alpha tokens are composited on their ground. */
'use strict';
const fs = require('fs');
const path = require('path');

const t = JSON.parse(fs.readFileSync(path.join(__dirname, 'tokens.json'), 'utf8'));
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const themes = t.color.themes.map(th => th.id);

// Which foreground sits on which ground. Keep it short: one line per real pairing in the components.
const TEXT = 4.5, UI = 3;
const PAIRS = [
  ...['surface-page', 'surface-base', 'surface-support-1'].flatMap(g => [
    ['text-strong', g, TEXT], ['text-moderate', g, TEXT], ['icon-strong', g, UI], ['border-divider-strong', g, UI],
  ]),
  ['text-alert', 'surface-page', TEXT], ['text-alert', 'surface-base', TEXT],
  ['text-success', 'surface-page', TEXT], ['text-success', 'surface-base', TEXT],
  ['action-secondary-border-default', 'surface-page', UI],
  ['action-primary-background-default', 'surface-page', UI],
  ['text-strong-invert', 'action-primary-background-default', TEXT],
  ['icon-strong-invert', 'action-primary-background-default', UI],
  ['text-on-alert', 'surface-alert', TEXT], ['text-on-success', 'surface-success', TEXT], ['text-on-warning', 'surface-warning', TEXT],
];

const byName = Object.fromEntries(t.color.tokens.map(tok => [tok.name, tok]));
const override = { accent: args.accent, 'support-1': args['support-1'] };
function resolve(name, theme, depth = 0) {
  if (override[name]) return override[name];
  const tok = byName[name];
  if (!tok || depth > 10) throw new Error(`unknown token ${name}`);
  let v = typeof tok.value === 'string' ? tok.value : (tok.value[theme] !== undefined ? tok.value[theme] : tok.value[themes[0]]);
  const m = /^\{(.+)\}$/.exec(v);
  return m ? resolve(m[1], theme, depth + 1) : v;
}
const rgba = hex => { const h = hex.replace('#', ''); const n = i => parseInt(h.slice(i, i + 2), 16) / 255; return [n(0), n(2), n(4), h.length === 8 ? n(6) : 1]; };
const over = (fg, bg) => [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1);
const lum = c => { const f = x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

let fails = 0;
for (const theme of themes) {
  // grounds are composited on the page colour (surface-page is opaque in every theme)
  const page = rgba(resolve('surface-page', theme));
  const rows = [];
  for (const [fg, bg, min] of PAIRS) {
    const ground = over(rgba(resolve(bg, theme)), page);
    const r = ratio(over(rgba(resolve(fg, theme)), ground), ground);
    if (r < min) { fails++; rows.push(`  FAIL ${r.toFixed(2).padStart(5)}:1 < ${min}  ${fg} on ${bg}`); }
  }
  console.log(`${theme}: ${rows.length ? rows.length + ' failing pair(s)' : 'all pairs pass'}`);
  rows.forEach(r => console.log(r));
}
if (args.accent || args['support-1']) console.log(`(palette: accent ${args.accent || 'as tokens.json'}, support-1 ${args['support-1'] || 'as tokens.json'})`);
if (fails && 'strict' in args) process.exit(1);
