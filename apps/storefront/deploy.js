/* apps/storefront/deploy.js — upload dist/<outputDir>/ to the host over FTPS.
   Credentials are never stored in the repo: user + password are read from the macOS
   Keychain entry that Cyberduck already saved for the host (macOS may ask once to allow it).
   Run: npm run deploy          (build first: npm run build)
        npm run deploy -- --list   (only list the remote folder, upload nothing) */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const APP = __dirname;
const site = JSON.parse(fs.readFileSync(path.join(APP, 'site.json'), 'utf8'));
const cfg = JSON.parse(fs.readFileSync(path.join(APP, 'deploy.json'), 'utf8'));
const DIST = path.join(APP, 'dist', site.outputDir || '');
const remoteDir = cfg.remoteDir.replace(/^\/|\/$/g, '');
const base = `ftp://${cfg.host}/${remoteDir}/`;

// 1) apps/storefront/.deploy.env (git-ignored): FTP_USER=… / FTP_PASS=…
// 2) fallback: the macOS Keychain entry Cyberduck saved for the host
const ENV_FILE = path.join(APP, '.deploy.env');
function credentials() {
  if (fs.existsSync(ENV_FILE)) {
    const env = Object.fromEntries(fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)
      .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]));
    if (env.FTP_USER && env.FTP_PASS) return { user: env.FTP_USER, pass: env.FTP_PASS };
  }
  const args = ['find-internet-password', '-s', cfg.host];
  try {
    const info = execFileSync('security', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const user = (info.match(/"acct"<blob>="([^"]*)"/) || [])[1];
    const pass = execFileSync('security', [...args, '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).replace(/\n$/, '');
    if (user && pass) return { user, pass };
  } catch { /* not found or access denied */ }
  fail(`No credentials: fill FTP_USER and FTP_PASS in ${path.relative(process.cwd(), ENV_FILE)}.`);
}

function fail(msg) { console.error('deploy: ' + msg); process.exit(1); }
const q = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === '.DS_Store') return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

// curl reads its config (incl. the password) from stdin, so nothing shows up in the process list
function curl(lines) {
  const r = spawnSync('curl', ['--config', '-'], { input: lines.join('\n') + '\n', stdio: ['pipe', 'inherit', 'inherit'] });
  if (r.status !== 0) fail(`curl exited with ${r.status}`);
}

const { user, pass } = credentials();
const common = [`user = ${q(user + ':' + pass)}`, 'ssl-reqd', 'silent', 'show-error'];

if (process.argv.includes('--list')) {
  curl([...common, 'list-only', `url = ${q(base)}`]);
  process.exit(0);
}

if (!fs.existsSync(DIST)) fail(`${path.relative(process.cwd(), DIST)} not found — run npm run build first.`);
const files = walk(DIST);
const lines = [...common, 'ftp-create-dirs'];
for (const f of files) {
  const rel = path.relative(DIST, f).split(path.sep).map(encodeURIComponent).join('/');
  lines.push(`upload-file = ${q(f)}`, `url = ${q(base + rel)}`);
}
console.log(`Uploading ${files.length} files to ${cfg.host}/${remoteDir}/ …`);
curl(lines);
console.log(`Done → ${cfg.publicUrl}`);
