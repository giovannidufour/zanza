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

  var TARGET_LUFS = -11;        // ≈ the loudest reggaefever.ch samples (their median ≈ −15, peak-normalized to 0 dBFS)
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
  // both K-weighting biquads in one pass over `x` (the same arithmetic as two passes one after the other). `each(i, v)`
  // gets every weighted sample: nothing is stored, so a long 96 kHz side costs no extra memory.
  function kWeight(x, fs, each) {
    var s = fs[0], h = fs[1];
    var sb0 = s.b[0], sb1 = s.b[1], sb2 = s.b[2], sa1 = s.a[0], sa2 = s.a[1];
    var hb0 = h.b[0], hb1 = h.b[1], hb2 = h.b[2], ha1 = h.a[0], ha2 = h.a[1];
    var x1 = 0, x2 = 0, m1 = 0, m2 = 0, y1 = 0, y2 = 0;
    for (var i = 0; i < x.length; i++) {
      var xi = x[i];
      var m = sb0 * xi + sb1 * x1 + sb2 * x2 - sa1 * m1 - sa2 * m2;
      var v = hb0 * m + hb1 * m1 + hb2 * m2 - ha1 * y1 - ha2 * y2;
      x2 = x1; x1 = xi; m2 = m1; m1 = m; y2 = y1; y1 = v;
      each(i, v);
    }
  }
  // integrated loudness in LUFS (−Infinity for silence); channels after the first two are ignored (weight 1 each)
  function loudness(channels, rate) {
    var fs = kFilters(rate), n = channels[0].length, block = Math.round(0.4 * rate), hop = Math.round(0.1 * rate);
    if (n < block) block = hop = n;
    var used = channels.slice(0, 2), powers = [], c, k, j, z, sum;
    if (block % hop === 0) {
      // a 400 ms block = its 100 ms hops: each weighted sample is squared and summed once (not four times, as when
      // every block was summed on its own), into the sum of its hop
      var per = block / hop, hops = Math.floor(n / hop), end = hops * hop, sums = [];
      used.forEach(function (x) {
        var hs = new Float64Array(hops), acc = 0, left = hop, at = 0;
        kWeight(x, fs, function (i, v) {
          if (i >= end) return;
          acc += v * v;
          if (--left === 0) { hs[at++] = acc; acc = 0; left = hop; }
        });
        sums.push(hs);
      });
      for (k = 0; k + per <= hops; k++) {
        z = 0;
        for (c = 0; c < sums.length; c++) { sum = 0; for (j = 0; j < per; j++) sum += sums[c][k + j]; z += sum / block; }
        powers.push(z);
      }
    } else {
      var weighted = used.map(function (x) { var w = new Float64Array(n); kWeight(x, fs, function (i, v) { w[i] = v; }); return w; });
      for (var s = 0; s + block <= n; s += hop) {
        z = 0;
        for (c = 0; c < weighted.length; c++) { sum = 0; for (j = s; j < s + block; j++) sum += weighted[c][j] * weighted[c][j]; z += sum / block; }
        powers.push(z);
      }
    }
    function lufs(p) { return -0.691 + 10 * Math.log10(p); }
    function mean(list) { var t = 0; for (var m = 0; m < list.length; m++) t += list[m]; return t / list.length; }
    var abs = powers.filter(function (p) { return lufs(p) > -70; });
    if (!abs.length) return -Infinity;
    var rel = lufs(mean(abs)) - 10;
    var gated = abs.filter(function (p) { return lufs(p) > rel; });
    return lufs(mean(gated.length ? gated : abs));
  }

  // ── limiter ──────────────────────────────────────────────────────────────
  // the loudest channel of every frame: it does not depend on the gain, so it is found once for all the tries
  function framePeaks(channels) {
    var n = channels[0].length, peaks = new Float32Array(n);
    for (var c = 0; c < channels.length; c++) {
      var x = channels[c];
      for (var i = 0; i < n; i++) { var v = x[i] < 0 ? -x[i] : x[i]; if (v > peaks[i]) peaks[i] = v; }
    }
    return peaks;
  }
  // gain (dB, ≤ 0) per frame so that |x · gain| ≤ ceiling on every channel: it starts going down LOOKAHEAD_S before a
  // peak (backward exponential pass) and comes back with RELEASE_S (forward pass). Both passes only lower the gain,
  // so the ceiling always holds.
  function limiterGains(peaks, rate, pre, ceiling) {
    var n = peaks.length, g = new Float32Array(n), i;
    for (i = 0; i < n; i++) { var p = peaks[i] * pre; if (p > ceiling) g[i] = db(ceiling / p); }
    var attack = Math.exp(-1 / (LOOKAHEAD_S * rate)), release = Math.exp(-1 / (RELEASE_S * rate));
    for (i = n - 2; i >= 0; i--) { var a = g[i + 1] * attack; if (a < g[i]) g[i] = a; }
    for (i = 1; i < n; i++) { var r = g[i - 1] * release; if (r < g[i]) g[i] = r; }
    return g;
  }
  function minOf(a) { var m = 0; for (var i = 0; i < a.length; i++) if (a[i] < m) m = a[i]; return m; }
  // the linear factor of every frame (pre-gain × limiter). A limiter gain within 1e-7 dB of 0 (where it has let go:
  // most of the file) is taken as 0 dB: a difference of 1e-8, far below what a 16-bit or MP3 sample can hold.
  function factors(gains, pre) {
    var n = gains.length, f = new Float32Array(n), k = Math.LN10 / 20;
    for (var i = 0; i < n; i++) { var g = gains[i]; f[i] = g > -1e-7 ? pre : pre * Math.exp(g * k); }
    return f;
  }

  // → { lufs, gainDb, reductionDb, changed }. Writes the result into `channels` (unless changed is false).
  function level(channels, rate, opts) {
    var o = opts || {};
    var target = o.targetLufs != null ? o.targetLufs : TARGET_LUFS;
    var ceiling = lin(o.ceilingDb != null ? o.ceilingDb : CEILING_DB);
    var maxRed = o.maxReductionDb != null ? o.maxReductionDb : MAX_REDUCTION_DB;
    var measured = loudness(channels, rate);
    if (!isFinite(measured) || Math.abs(target - measured) < SKIP_LU) return { lufs: measured, gainDb: 0, reductionDb: 0, changed: false };
    var peaks = framePeaks(channels);
    var gainDb = Math.min(MAX_GAIN_DB, target - measured), gains;
    for (var tries = 0; ; tries++) {    // lower the gain by what the limiter would take beyond maxRed
      gains = limiterGains(peaks, rate, lin(gainDb), ceiling);
      var over = -minOf(gains) - maxRed;
      if (over <= 0.05 || tries === 4) break;
      gainDb -= over;
    }
    // the limiter takes some loudness away: measure what it leaves and make up the difference once (same cap)
    var f = factors(gains, lin(gainDb));
    var trial = channels.map(function (c) {
      var t = new Float32Array(c.length);
      for (var i = 0; i < c.length; i++) t[i] = c[i] * f[i];
      return t;
    });
    var short = target - loudness(trial, rate);
    var madeUp = false;
    if (short > 0.1 && gainDb < MAX_GAIN_DB) {
      var more = Math.min(MAX_GAIN_DB, gainDb + short), g2 = limiterGains(peaks, rate, lin(more), ceiling);
      if (-minOf(g2) <= maxRed + 0.05) { gainDb = more; gains = g2; madeUp = true; }
    }
    var reduction = -minOf(gains);
    if (madeUp) {
      f = factors(gains, lin(gainDb));
      channels.forEach(function (c) { for (var i = 0; i < c.length; i++) c[i] *= f[i]; });
    } else {
      channels.forEach(function (c, k) { c.set(trial[k]); });   // the trial is already the result
    }
    return { lufs: measured, gainDb: gainDb, reductionDb: reduction, changed: true };
  }

  return { TARGET_LUFS: TARGET_LUFS, CEILING_DB: CEILING_DB, MAX_REDUCTION_DB: MAX_REDUCTION_DB,
           loudness: loudness, level: level };
}));
