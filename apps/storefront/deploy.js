/* apps/storefront/deploy.js — upload dist/<outputDir>/ to the host over FTPS.
   Credentials are never stored in the repo: user + password are read from the macOS
   Keychain entry that Cyberduck already saved for the host (macOS may ask once to allow it).
   Run: npm run deploy          (build first: npm run build)
        npm run deploy -- --list   (only list the remote folder, upload nothing)
        npm run deploy -- --verify (only compare the live site with dist/, upload nothing)
   After every upload the live site is verified (see verify()). */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const crypto = require('crypto');

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
// tls-max 1.2: this host aborts data transfers above ~15 KB with FTP 451 when macOS curl (SecureTransport/LibreSSL)
// negotiates TLS 1.3; with TLS 1.2 they go through (diagnosed 2026-11-07 with size probes, content-independent).
const common = [`user = ${q(user + ':' + pass)}`, 'ssl-reqd', 'tls-max = 1.2', 'silent', 'show-error'];

if (process.argv.includes('--list')) {
  curl([...common, 'list-only', `url = ${q(base)}`]);
  process.exit(0);
}

const sleep = (s) => spawnSync('sleep', [String(s)]);

// Post-deploy check, safe for the host's firewall: it requests ONLY the files that are in dist/ (never paths built
// from the project folder: probing .git/, node_modules/, .env… is what vulnerability scanners do, and the host bans
// the IP for it — happened 2026-11-07), one at a time, 1s apart, cache-bypassed, and compares them byte for byte.
function verify(list) {
  const sha = (b) => crypto.createHash('sha1').update(b).digest('hex');
  let bad = 0;
  for (const f of list) {
    const rel = path.relative(DIST, f).split(path.sep).join('/');
    const url = cfg.publicUrl.replace(/\/?$/, '/') + rel.replace(/(^|\/)index\.html$/, '$1') + '?verify=' + Date.now();
    const r = spawnSync('curl', ['-s', '-f', '--max-time', '20', url], { maxBuffer: 64 * 1024 * 1024 });
    const same = r.status === 0 && sha(r.stdout) === sha(fs.readFileSync(f));
    if (!same) bad++;
    console.log(`${same ? 'live' : 'DIFF'} ${rel}${r.status === 0 ? '' : ` (curl ${r.status})`}`);
    sleep(1);
  }
  if (bad) fail(`${bad} file(s) differ from dist/ on ${cfg.publicUrl} (if every request fails, the host may be blocking this IP).`);
  console.log(`Verified: the live site matches dist/ (${list.length} files).`);
}

if (!fs.existsSync(DIST)) fail(`${path.relative(process.cwd(), DIST)} not found — run npm run build first.`);
const files = walk(DIST);
if (process.argv.includes('--verify')) { verify(files); process.exit(0); }
const urlOf = (f) => base + path.relative(DIST, f).split(path.sep).map(encodeURIComponent).join('/');

// Safe upload: each file goes up as `<name>.uploading` and is renamed onto `<name>` only after the transfer
// completed (RNFR/RNTO as post-quote commands). A failed transfer (e.g. FTP 451) therefore never truncates
// the live file: the site keeps the previous version until the rename succeeds.
// One curl call per file, so the rename commands apply to that file only. Returns the files that failed.
function upload(batch) {
  return batch.filter((f) => {
    const name = path.basename(f);
    const tmp = name + '.uploading';
    const tmpUrl = urlOf(f).replace(/[^/]+$/, encodeURIComponent(tmp));
    const lines = [...common, 'ftp-create-dirs', 'write-out = "%{response_code}\\n"',
      `upload-file = ${q(f)}`, `url = ${q(tmpUrl)}`,
      `quote = ${q('-RNFR ' + tmp)}`, `quote = ${q('-RNTO ' + name)}`];
    const r = spawnSync('curl', ['--config', '-'], { input: lines.join('\n') + '\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] });
    const ok = r.status === 0;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${path.relative(DIST, f)}${ok ? '' : ` (curl ${r.status}, ftp ${String(r.stdout).trim() || '?'})`}`);
    return !ok;
  });
}

console.log(`Uploading ${files.length} files to ${cfg.host}/${remoteDir}/ …`);
let pending = upload(files);
// transient server errors (4xx like 451): retry only the failed files, with backoff
for (let attempt = 1; pending.length && attempt <= 3; attempt++) {
  console.log(`Retrying ${pending.length} file(s) in ${attempt * 2}s (attempt ${attempt}/3) …`);
  sleep(attempt * 2);
  pending = upload(pending);
}
if (pending.length) fail(`${pending.length} file(s) not uploaded — the site may be partially updated. Run the deploy again.`);
console.log(`Uploaded → ${cfg.publicUrl}`);
verify(files);
