/* packages/ui/build-artifact.js
   Assembles the "Zanza Design System" artifact (claude.ai Design System type) from this package.
   The artifact is DERIVED: never edit it by hand. Output: packages/ui/artifact/project/ */
'use strict';
const fs = require('fs');
const path = require('path');
const UI = __dirname;
const OUT = path.join(UI, 'artifact/project');

function put(rel, content) { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); console.log('  ' + rel); }
const read = (p) => fs.readFileSync(path.join(UI, p), 'utf8');

fs.rmSync(path.join(UI, 'artifact'), { recursive: true, force: true });
console.log('artifact/project/');
put('tokens.json', read('tokens.json'));
put('README.md', read('README.md'));
put('components/bundle.js', read('components.js'));
// bundle.css = components + the responsive text-style variants (the artifact builds its own classes from tokens.json,
// but not the `--mobile` ones). @media (--mobile) → real query.
const responsiveType = read('tokens.css').split('/* @responsive-type */')[1] || '';
put('components/bundle.css', require('./media.js').expandMedia(read('components.css') + '\n/* responsive text styles (from tokens.css) */' + responsiveType));
put('components/index.d.ts', read('components.d.ts'));
for (const comp of fs.readdirSync(path.join(UI, 'docs'))) {
  for (const f of fs.readdirSync(path.join(UI, 'docs', comp))) put(`components/${comp}/${f}`, read(`docs/${comp}/${f}`));
}
console.log('done');
