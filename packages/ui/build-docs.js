/* packages/ui/build-docs.js — writes the API tables of docs/<Comp>/README.md from components.d.ts.
   components.d.ts is the single source of the component API: in a README, the block between
   `<!-- api: FooProps BarProps -->` and `<!-- /api -->` is regenerated on every build — never edit it by hand. */
const fs = require('fs');
const path = require('path');

const UI = __dirname;
const dts = fs.readFileSync(path.join(UI, 'components.d.ts'), 'utf8');

// interface name → [{ name, optional, type, doc }]
const api = {};
let current = null, doc = null;
for (const line of dts.split('\n')) {
  const open = line.match(/^export interface (\w+)\b.*\{\s*$/);
  if (open) { current = api[open[1]] = []; doc = null; continue; }
  if (!current) continue;
  if (/^\}/.test(line)) { current = null; continue; }
  const d = line.match(/^\s*\/\*\*\s*(.*?)\s*\*\/\s*$/);
  if (d) { doc = d[1]; continue; }
  const p = line.match(/^\s*"?([\w-]+)"?(\?)?:\s*(.+?);\s*$/);
  if (p) { current.push({ name: p[1], optional: !!p[2], type: p[3], doc: doc || '' }); doc = null; }
}

const pipe = s => s.replace(/\|/g, '\\|');
const cell = s => pipe(s).replace(/</g, '&lt;');   // notes are prose: escape tags like <svg>
function table(name) {
  const props = api[name];
  if (!props) throw new Error(`build-docs: interface ${name} not found in components.d.ts`);
  const rows = props.map(p => {
    let text = p.doc, def = '';
    const m = text.match(/\s*@default\s+(\S+)\s*$/);
    if (m) { def = m[1].replace(/"/g, ''); text = text.slice(0, m.index); }
    return `| \`${p.name}\`${p.optional ? '' : ' *'} | \`${pipe(p.type)}\` | ${def ? '`' + def + '`' : ''} | ${cell(text)} |`;
  });
  return ['| Prop | Type | Default | Notes |', '| --- | --- | --- | --- |', ...rows].join('\n');
}

let changed = 0;
for (const comp of fs.readdirSync(path.join(UI, 'docs'))) {
  const file = path.join(UI, 'docs', comp, 'README.md');
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  const out = src.replace(/<!-- api: ([\w ]+?) -->[\s\S]*?<!-- \/api -->/g, (_, names) => {
    const list = names.trim().split(/\s+/);
    const body = list.map(n => (list.length > 1 ? `### ${n.replace(/Props$/, '')}\n\n` : '') + table(n)).join('\n\n');
    return `<!-- api: ${names} -->\n<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->\n${body}\n\n\`*\` required.\n<!-- /api -->`;
  });
  if (out !== src) { fs.writeFileSync(file, out); changed++; }
}
console.log(`build-docs: ${changed} README(s) updated`);
