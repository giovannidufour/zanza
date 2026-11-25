/* packages/audio/web-level.js — the level of the shop's sample MP3s (decision 0192). ONE file for the admin
   (apps/admin/admin.js: every sample upload and clip) and the Mac Scanner (apps/scanner: Push to admin, run in
   JavaScriptCore from the app's Resources). No dependencies, no DOM. Works as a CommonJS module and as a classic
   script (globalThis.HighmuzikWebLevel).

   Only the 128 kbps copy the shop plays goes through here. The files Gio keeps and DJs with (Scanner WAV and MP3 320)
   keep the plain +8 dB of 0157 and are never limited.

   What it does, in place on the decoded channels (Float32Array, −1…1):
   · measures the integrated loudness (EBU R128 / ITU-R BS.1770: K-weighting, 400 ms blocks, gates −70 LUFS / −10 LU)
   · one gain brings it to TARGET_LUFS: every sample of the shop plays at the same level, whatever came in (a file
     with the Scanner's +8 dB is not raised twice: it ends at the same target)
   · a look-ahead peak limiter keeps every sample at CEILING_DB (the MP3 encoder adds up to ~1 dB: still < −1 dBTP)
   · the gain is lowered until the limiter takes off at most MAX_REDUCTION_DB: a very dynamic side stays a bit quieter
     instead of being squashed */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HighmuzikWebLevel = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var TARGET_LUFS = -11;        // TODO(0192): calibrate on reggaefever.ch samples
  var CEILING_DB = -2;          // the headroom of 0157: the MP3 encoder can add ~1 dB on a limited peak
  var MAX_REDUCTION_DB = 6;
  var MAX_GAIN_DB = 24;         // a near-silent file is not blown up
  var LOOKAHEAD_S = 0.005, RELEASE_S = 0.1;
  var SKIP_LU = 1;              // within 1 LU of the target = already at level (e.g. a clip cut from a levelled file): untouched

  function db(x) { return 20 * Math.log10(x); }
  function lin(d) { return Math.pow(10, d / 20); }

  // ── loudness ─────────────────────────────────────────────────────────────
  // K-weighting biquads for any sample rate (coefficients derived as in libebur128)
  function kFilters(rate) {
    var f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
    var K = Math.tan(Math.PI * f0 / rate), Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
    var a0 = 1 + K / Q + K * K;
    var shelf = { b: [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0],
                  a: [2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0] };
    f0 = 38.13547087602444; Q = 0.5003270373238773; K = Math.tan(Math.PI * f0 / rate);
    var hp = { b: [1, -2, 1], a: [2 * (K * K - 1) / (1 + K / Q + K * K), (1 - K / Q + K * K) / (1 + K / Q + K * K)] };
    return [shelf, hp];
  }
  function biquad(x, f) {
    var y = new Float64Array(x.length), x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (var i = 0; i < x.length; i++) {
      var v = f.b[0] * x[i] + f.b[1] * x1 + f.b[2] * x2 - f.a[0] * y1 - f.a[1] * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  }
  // integrated loudness in LUFS (−Infinity for silence); channels after the first two are ignored (weight 1 each)
  function loudness(channels, rate) {
    var fs = kFilters(rate), n = channels[0].length, block = Math.round(0.4 * rate), hop = Math.round(0.1 * rate);
    if (n < block) block = hop = n;
    var weighted = channels.slice(0, 2).map(function (c) { return biquad(biquad(c, fs[0]), fs[1]); });
    var powers = [];
    for (var s = 0; s + block <= n; s += hop) {
      var z = 0;
      weighted.forEach(function (w) { var sum = 0; for (var i = s; i < s + block; i++) sum += w[i] * w[i]; z += sum / block; });
      powers.push(z);
    }
    function lufs(p) { return -0.691 + 10 * Math.log10(p); }
    function mean(list) { return list.reduce(function (a, b) { return a + b; }, 0) / list.length; }
    var abs = powers.filter(function (p) { return lufs(p) > -70; });
    if (!abs.length) return -Infinity;
    var rel = lufs(mean(abs)) - 10;
    var gated = abs.filter(function (p) { return lufs(p) > rel; });
    return lufs(mean(gated.length ? gated : abs));
  }

  // ── limiter ──────────────────────────────────────────────────────────────
  // gain (dB, ≤ 0) per frame so that |x · gain| ≤ ceiling on every channel: it starts going down LOOKAHEAD_S before a
  // peak (backward exponential pass) and comes back with RELEASE_S (forward pass). Both passes only lower the gain,
  // so the ceiling always holds.
  function limiterGains(channels, rate, pre, ceiling) {
    var n = channels[0].length, g = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var p = 0;
      for (var c = 0; c < channels.length; c++) { var v = Math.abs(channels[c][i]); if (v > p) p = v; }
      p *= pre;
      g[i] = p > ceiling ? db(ceiling / p) : 0;
    }
    var attack = Math.exp(-1 / (LOOKAHEAD_S * rate)), release = Math.exp(-1 / (RELEASE_S * rate));
    for (i = n - 2; i >= 0; i--) g[i] = Math.min(g[i], g[i + 1] * attack);
    for (i = 1; i < n; i++) g[i] = Math.min(g[i], g[i - 1] * release);
    return g;
  }
  function minOf(a) { var m = 0; for (var i = 0; i < a.length; i++) if (a[i] < m) m = a[i]; return m; }

  // → { lufs, gainDb, reductionDb, changed }. Writes the result into `channels` (unless changed is false).
  function level(channels, rate, opts) {
    var o = opts || {};
    var target = o.targetLufs != null ? o.targetLufs : TARGET_LUFS;
    var ceiling = lin(o.ceilingDb != null ? o.ceilingDb : CEILING_DB);
    var maxRed = o.maxReductionDb != null ? o.maxReductionDb : MAX_REDUCTION_DB;
    var measured = loudness(channels, rate);
    if (!isFinite(measured) || Math.abs(target - measured) < SKIP_LU) return { lufs: measured, gainDb: 0, reductionDb: 0, changed: false };
    var gainDb = Math.min(MAX_GAIN_DB, target - measured), gains;
    for (var tries = 0; ; tries++) {    // lower the gain by what the limiter would take beyond maxRed
      gains = limiterGains(channels, rate, lin(gainDb), ceiling);
      var over = -minOf(gains) - maxRed;
      if (over <= 0.05 || tries === 4) break;
      gainDb -= over;
    }
    // the limiter takes some loudness away: measure what it leaves and make up the difference once (same cap)
    var trial = channels.map(function (c) {
      var t = new Float32Array(c.length), pre = lin(gainDb);
      for (var i = 0; i < c.length; i++) t[i] = c[i] * pre * lin(gains[i]);
      return t;
    });
    var short = target - loudness(trial, rate);
    if (short > 0.1 && gainDb < MAX_GAIN_DB) {
      var more = Math.min(MAX_GAIN_DB, gainDb + short), g2 = limiterGains(channels, rate, lin(more), ceiling);
      if (-minOf(g2) <= maxRed + 0.05) { gainDb = more; gains = g2; }
    }
    var reduction = -minOf(gains);
    var pre = lin(gainDb);
    channels.forEach(function (c) { for (var i = 0; i < c.length; i++) c[i] *= pre * lin(gains[i]); });
    return { lufs: measured, gainDb: gainDb, reductionDb: reduction, changed: true };
  }

  return { TARGET_LUFS: TARGET_LUFS, CEILING_DB: CEILING_DB, MAX_REDUCTION_DB: MAX_REDUCTION_DB,
           loudness: loudness, level: level };
}));
