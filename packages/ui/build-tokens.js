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

// color: a string value, or an alias "{other}" -> var(--other). One theme today.
const theme = t.color.themes[0].id;
for (const tok of t.color.tokens) {
  const raw = typeof tok.value === 'string' ? tok.value : tok.value[theme];
  const m = /^\{(.+)\}$/.exec(raw);
  lines.push(`  --${tok.name}: ${m ? `var(--${m[1]})` : raw};`);
}

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
