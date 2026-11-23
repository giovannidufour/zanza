// Copies the shared browser/server files into the Edge Functions that need them, so each function folder is complete
// for the Supabase dashboard editor (one folder = what gets deployed). Run after changing packages/shipping/shipping.js, packages/images/images.js, packages/file-names/file-names.js or packages/listing-draft/listing-draft.js:
//   node supabase/scripts/sync-functions.js          (writes the copies)
//   node supabase/scripts/sync-functions.js --check  (exit 1 if a copy is stale; part of npm run build)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const COPIES = [
  ['packages/shipping/shipping.js', 'supabase/functions/create-checkout/shipping.js'],
  ['packages/images/images.js', 'supabase/functions/sign-upload/images.js'],   // decision 0108
  ['packages/images/images.js', 'supabase/functions/purge-media/images.js'],
  ['packages/file-names/file-names.js', 'supabase/functions/scan-targets/file-names.js'],   // decision 0138
  ['packages/listing-draft/listing-draft.js', 'supabase/functions/scanner-draft/listing-draft.js'],   // decision 0145
];
const check = process.argv.includes('--check');
let stale = 0;
for (const [from, to] of COPIES) {
  const src = fs.readFileSync(path.join(root, from), 'utf8');
  const dest = path.join(root, to);
  const cur = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
  if (cur === src) continue;
  if (check) { console.error(`stale copy: ${to} (run node supabase/scripts/sync-functions.js, then redeploy the function)`); stale++; }
  else { fs.writeFileSync(dest, src); console.log(`copied ${from} → ${to}`); }
}
if (stale) process.exit(1);
