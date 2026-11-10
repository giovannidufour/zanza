/* packages/ui/build-tokens.js
   tokens.json -> tokens.css. The only place CSS custom properties are declared.
   Run: node packages/ui/build-tokens.js   (also run by `npm run build`) */
'use strict';
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'tokens.json');
const out = path.join(__dirname, 'tokens.css');
const t = JSON.parse(fs.readFileSync(src, 'utf8'));

const lines = [`/* ${t.name} — generated from tokens.json by build-tokens.js. Do not edit. */`, ':root {'];

// color: a string value (same in every theme), or { <themeId>: value } per Figma mode.
// An alias "{other}" -> var(--other). The first theme is :root; the others are emitted below as
// [data-theme="<id>"] blocks that redeclare only the tokens whose value differs.
const themes = t.color.themes.map(th => th.id);
const cssValue = raw => { const m = /^\{(.+)\}$/.exec(raw); return m ? `var(--${m[1]})` : raw; };
const valueIn = (tok, id) => (typeof tok.value === 'string' ? tok.value : tok.value[id]);
for (const tok of t.color.tokens) lines.push(`  --${tok.name}: ${cssValue(valueIn(tok, themes[0]))};`);

// spacing, radius, shadow, any other list family
for (const [family, def] of Object.entries(t)) {
  if (['name', 'version', 'meta', 'color', 'type', 'breakpoint'].includes(family) || !def || !Array.isArray(def.tokens)) continue;
  lines.push('');
  lines.push(`  /* ${family} */`);
  for (const tok of def.tokens) lines.push(`  --${tok.name}: ${tok.value};`);
}

// type families
lines.push('');
lines.push('  /* type families */');
for (const [key, stack] of Object.entries(t.type.families)) lines.push(`  --font-${key}: ${stack};`);
lines.push('}');

// the first theme also gets a [data-theme] block with every per-mode token, so it can be nested inside another theme
// (Figma: a frame with an explicit mode inside a frame in another mode, e.g. the shop preview inside the admin, 0030)
lines.push('', `[data-theme="${themes[0]}"] {`);
for (const tok of t.color.tokens) if (typeof tok.value === 'object') lines.push(`  --${tok.name}: ${cssValue(valueIn(tok, themes[0]))};`);
lines.push('}');

// other themes (Figma modes of the `color` collection), e.g. backend = the admin
for (const id of themes.slice(1)) {
  const diff = t.color.tokens.filter(tok => typeof tok.value === 'object' && tok.value[id] !== undefined && tok.value[id] !== tok.value[themes[0]]);
  lines.push('', `[data-theme="${id}"] {`);
  for (const tok of diff) lines.push(`  --${tok.name}: ${cssValue(tok.value[id])};`);
  lines.push('}');
}

// type styles as classes (mirror of Figma text styles). The class carries the sizes; components only apply it.
function styleRule(selector, g, s, indent = '') {
  const fam = s.family || g.family;
  const out = ['', `${indent}${selector} {`];
  out.push(`${indent}  font-family: var(--font-${fam});`);
  out.push(`${indent}  font-size: ${s.fontSize};`);
  if (s.lineHeight) out.push(`${indent}  line-height: ${s.lineHeight};`);
  if (s.fontWeight) out.push(`${indent}  font-weight: ${s.fontWeight};`);
  if (s.letterSpacing) out.push(`${indent}  letter-spacing: ${s.letterSpacing};`);
  if (g.name === 'Label') out.push(`${indent}  text-transform: uppercase;`);
  out.push(`${indent}}`);
  return out;
}
for (const g of t.type.groups) for (const s of g.styles) lines.push(...styleRule(`.${s.name}`, g, s));

// responsive variants: `.<style>--mobile` applies that style only below the `--mobile` breakpoint.
// Used by components with device=responsive (e.g. ProductInfo: body-extra-large body-large--mobile).
// `@media (--mobile)` is expanded at build time by media.js. Marker below is read by build-artifact.js.
lines.push('');
lines.push('/* @responsive-type */');
lines.push('@media (--mobile) {');
for (const g of t.type.groups) for (const s of g.styles) lines.push(...styleRule(`.${s.name}--mobile`, g, s, '  '));
lines.push('}');

fs.writeFileSync(out, lines.join('\n') + '\n');
console.log(`tokens.css written (${t.color.tokens.length} colors)`);
