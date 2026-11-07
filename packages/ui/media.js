/* packages/ui/media.js
   Expands custom media queries from tokens.json `breakpoint` (e.g. `@media (--mobile)`)
   into real media queries. CSS sources never repeat a breakpoint value: they name it.
   Used by every build that ships CSS (apps/storefront/build.js, build-artifact.js). */
'use strict';
const fs = require('fs');
const path = require('path');

const tokens = JSON.parse(fs.readFileSync(path.join(__dirname, 'tokens.json'), 'utf8'));
const queries = Object.fromEntries((tokens.breakpoint?.tokens || []).map(t => [t.name, t.value]));

function expandMedia(css) {
  // only inside @media preludes, so var(--x) in declarations is never touched
  return String(css).replace(/@media[^{]*/g, prelude => prelude.replace(/\(--([a-z0-9-]+)\)/g, (m, name) => {
    if (!(name in queries)) throw new Error(`media.js: unknown custom media "--${name}" (add it to tokens.json → breakpoint)`);
    return queries[name];
  }));
}

module.exports = { expandMedia, queries };
