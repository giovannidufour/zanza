/* packages/crate-photo/crate-photo.js — admin → Take photo (decision 0200): from one phone photo of a 7" record to the
   two Scanner-style crops (decision 0153), both centred on the spindle hole:
     Full  180 mm square   → kept with the SKU, not shown in the shop (listings.original_keys, migration 0045)
     Label 96.52 mm (3.8") → photo 1 (Label A) or 2 (Label B) of the listing
   Steps (all automatic):
     1. perspective: the 4 black squares of the optional A4 sheet (crate-photo-sheet-7in.pdf) → exact homography;
        no sheet → the record outline (an ellipse) is made a circle
     2. centre: the spindle hole (7.24 mm, or 38.2 mm for a large-hole 7"), else the record outline
     3. light: a plane per channel fitted on the paper around the record is divided out (paper → 240)
     4. the Scanner look: an affine colour transform per camera (live | phone) + softening for the phone camera
   The user turns both crops together (drag, 90°) around the hole: `crop(…, angle)`.
   Pure JavaScript on ImageData-like objects { width, height, data: RGBA }: no DOM, so Node can test it.
   Classic script (window.HighmuzikCratePhoto) and CommonJS. Ported from prototypes/crate-camera (2026-11-27). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HighmuzikCratePhoto = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // the sheet (crate-photo-sheet-7in.pdf): marker centres in mm from the sheet centre, portrait
  var MARKERS = [[-80, -120], [80, -120], [80, 120], [-80, 120]];
  var RECORD_R = 87.5;                     // 7" record radius (175 mm)
  var FULL_MM = 180, LABEL_MM = 96.52;     // decision 0153
  var OUT = 1600;                          // px, as every listing photo (backend.md → Storage)
  var PAPER = 240;                         // the paper ends up this white in every photo

  // ── small helpers ──────────────────────────────────────────────────────────
  function lumAt(d, i) { return d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; }

  // area-average downscale to width W (+ luminance and its Otsu threshold)
  function downscale(src, W) {
    var H = Math.max(1, Math.round(src.height * W / src.width));
    var d = new Uint8ClampedArray(W * H * 4), S = src.data, SW = src.width, kx = src.width / W, ky = src.height / H;
    for (var y = 0; y < H; y++) {
      var y0 = Math.floor(y * ky), y1 = Math.max(y0 + 1, Math.floor((y + 1) * ky));
      for (var x = 0; x < W; x++) {
        var x0 = Math.floor(x * kx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * kx));
        var r = 0, g = 0, b = 0, n = 0;
        // at most 4 × 4 samples per output pixel: enough for a mask, fast on 12 MP
        var sy = Math.max(1, Math.floor((y1 - y0) / 4)), sx = Math.max(1, Math.floor((x1 - x0) / 4));
        for (var yy = y0; yy < y1; yy += sy) for (var xx = x0; xx < x1; xx += sx) {
          var i = (yy * SW + xx) * 4; r += S[i]; g += S[i + 1]; b += S[i + 2]; n++;
        }
        var o = (y * W + x) * 4;
        d[o] = r / n; d[o + 1] = g / n; d[o + 2] = b / n; d[o + 3] = 255;
      }
    }
    var lum = new Uint8Array(W * H);
    for (var p = 0; p < W * H; p++) lum[p] = lumAt(d, p * 4) | 0;
    return { width: W, height: H, data: d, lum: lum, thr: otsu(lum) };
  }

  function otsu(lum) {
    var N = lum.length, hist = new Array(256).fill(0), t;
    for (var p = 0; p < N; p++) hist[lum[p]]++;
    var sum = 0; for (t = 0; t < 256; t++) sum += t * hist[t];
    var wB = 0, sB = 0, best = 0, thr = 60;
    for (t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue; var wF = N - wB; if (!wF) break;
      sB += t * hist[t]; var m = sB / wB - (sum - sB) / wF, v = wB * wF * m * m;
      if (v > best) { best = v; thr = t; }
    }
    return thr;
  }

  // 4-connected components of a mask: bounding box, centroid, row spans, touches the frame
  function components(mask, W, H, minN) {
    var N = W * H, lab = new Int32Array(N), out = [], stack = [], cur = 0;
    for (var p = 0; p < N; p++) {
      if (!mask[p] || lab[p]) continue;
      cur++; var n = 0, edge = false, x0 = W, x1 = 0, y0 = H, y1 = 0, sx = 0, sy = 0, rows = new Map();
      stack.push(p); lab[p] = cur;
      while (stack.length) {
        var q = stack.pop(); n++;
        var x = q % W, y = (q / W) | 0;
        sx += x; sy += y;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        var r = rows.get(y); if (!r) rows.set(y, [x, x]); else { if (x < r[0]) r[0] = x; if (x > r[1]) r[1] = x; }
        if (x > 0 && mask[q - 1] && !lab[q - 1]) { lab[q - 1] = cur; stack.push(q - 1); }
        if (x < W - 1 && mask[q + 1] && !lab[q + 1]) { lab[q + 1] = cur; stack.push(q + 1); }
        if (y > 0 && mask[q - W] && !lab[q - W]) { lab[q - W] = cur; stack.push(q - W); }
        if (y < H - 1 && mask[q + W] && !lab[q + W]) { lab[q + W] = cur; stack.push(q + W); }
      }
      if (n >= minN) out.push({ n: n, edge: edge, x0: x0, x1: x1, y0: y0, y1: y1, cx: sx / n, cy: sy / n, rows: rows });
    }
    return out;
  }

  function erode(mask, W, H, r) {
    var m = mask;
    for (var i = 0; i < r; i++) {
      var o = new Uint8Array(W * H);
      for (var y = 1; y < H - 1; y++) for (var x = 1; x < W - 1; x++) {
        var p = y * W + x;
        o[p] = m[p] && m[p - 1] && m[p + 1] && m[p - W] && m[p + W] ? 1 : 0;
      }
      m = o;
    }
    return m;
  }

  // ellipse of the row-filled component (label and spindle hole filled) and how round it is
  function ellipseOf(c) {
    var m = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    c.rows.forEach(function (span, y) { for (var x = span[0]; x <= span[1]; x++) { m++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; } });
    var cx = sx / m, cy = sy / m;
    var vxx = sxx / m - cx * cx, vyy = syy / m - cy * cy, vxy = sxy / m - cx * cy;
    var tr = vxx + vyy, det = vxx * vyy - vxy * vxy, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
    var a = 2 * Math.sqrt(tr / 2 + disc), b = 2 * Math.sqrt(Math.max(1e-6, tr / 2 - disc));
    var theta = 0.5 * Math.atan2(2 * vxy, vxx - vyy), co = Math.cos(theta), si = Math.sin(theta);
    var area = Math.PI * a * b, fillA = Math.min(m, area) / Math.max(m, area), outside = 0;
    c.rows.forEach(function (span, y) {
      [span[0], span[1]].forEach(function (x) {
        var u = ((x - cx) * co + (y - cy) * si) / a, v = (-(x - cx) * si + (y - cy) * co) / b;
        if (u * u + v * v > 1.12) outside++;
      });
    });
    return { n: m, cx: cx, cy: cy, a: a, b: b, theta: theta, fill: fillA * (1 - outside / (c.rows.size * 2)) };
  }

  // the best disc, whatever its colour: "darker than t" masks at several levels (black, grey, coloured vinyl…)
  // plus "differs from the frame border", each at a few erosion levels (a record touching a dark table comes loose)
  function detectEllipse(s) {
    var W = s.width, H = s.height, d = s.data, lum = s.lum, N = W * H, masks = [], p, t;
    var levels = [s.thr]; for (t = 32; t <= 224; t += 16) if (levels.indexOf(t) < 0) levels.push(t);
    levels.forEach(function (lv) { var m = new Uint8Array(N); for (var q = 0; q < N; q++) m[q] = lum[q] <= lv ? 1 : 0; masks.push(m); });
    var br = [], bg = [], bb = [];
    function push(x, y) { var i = (y * W + x) * 4; br.push(d[i]); bg.push(d[i + 1]); bb.push(d[i + 2]); }
    for (var x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
    for (var y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
    function med(a) { return a.sort(function (u, v) { return u - v; })[a.length >> 1]; }
    var R = med(br), G = med(bg), B = med(bb), diff = new Uint8Array(N);
    for (p = 0; p < N; p++) { var i = p * 4, e1 = d[i] - R, e2 = d[i + 1] - G, e3 = d[i + 2] - B; diff[p] = e1 * e1 + e2 * e2 + e3 * e3 > 45 * 45 ? 1 : 0; }
    masks.push(diff);
    var pick = null;
    masks.forEach(function (mask) {
      [0, 3, 6].forEach(function (er) {
        components(erode(mask, W, H, er), W, H, N * 0.03).forEach(function (c) {
          if (c.edge || c.n > N * 0.9) return;
          var f = ellipseOf(c);
          f.a += er; f.b += er;
          if (f.b / f.a < 0.6) return;          // more squashed than any photo from above
          f.score = f.fill * Math.min(1, f.n / (N * 0.08));
          if (!pick || f.score > pick.score) pick = f;
        });
      });
    });
    return pick && pick.score >= 0.5 ? pick : null;
  }

  // the sheet's four black squares: small, square, solid dark components; the outermost four win
  function findMarkers(s, sd) {
    var W = s.width, H = s.height, lum = s.lum, thr = s.thr, N = W * H;
    var dark = new Uint8Array(N); for (var p = 0; p < N; p++) dark[p] = lum[p] <= thr ? 1 : 0;
    var cand = components(dark, W, H, Math.max(12, N * 0.00015)).filter(function (c) {
      if (c.edge || c.n > N * 0.01) return false;
      var w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1;
      return w >= 4 && h >= 4 && w / h > 0.5 && w / h < 2 && c.n / (w * h) > 0.7;
    });
    if (cand.length < 4) return null;
    function pickBy(f) { return cand.reduce(function (a, c) { return f(c) > f(a) ? c : a; }); }
    var quad = [pickBy(function (c) { return -(c.cx + c.cy); }), pickBy(function (c) { return c.cx - c.cy; }),
                pickBy(function (c) { return c.cx + c.cy; }), pickBy(function (c) { return c.cy - c.cx; })];
    if (new Set(quad).size < 4) return null;
    var ns = quad.map(function (c) { return c.n; });
    if (Math.min.apply(null, ns) < Math.max.apply(null, ns) * 0.35) return null;
    var area = Math.abs(quad.reduce(function (a, c, i) { var n = quad[(i + 1) % 4]; return a + c.cx * n.cy - n.cx * c.cy; }, 0)) / 2;
    if (area < N * 0.15) return null;
    // the sheet is portrait (160 × 240 mm between markers): if the photo shows it sideways, turn the order
    function dist(a, b) { return Math.hypot(a.cx - b.cx, a.cy - b.cy); }
    if (dist(quad[0], quad[1]) > dist(quad[1], quad[2])) quad = [quad[3], quad[0], quad[1], quad[2]];
    // refine each centre on the full photo: centroid of the dark pixels in its box
    var k = sd.width / W, D = sd.data, SW = sd.width;
    return quad.map(function (c) {
      var pad = (c.x1 - c.x0 + 1) * 0.4;
      var X0 = Math.max(0, Math.floor((c.x0 - pad) * k)), X1 = Math.min(SW - 1, Math.ceil((c.x1 + 1 + pad) * k));
      var Y0 = Math.max(0, Math.floor((c.y0 - pad) * k)), Y1 = Math.min(sd.height - 1, Math.ceil((c.y1 + 1 + pad) * k));
      var n = 0, sx = 0, sy = 0;
      for (var y = Y0; y <= Y1; y++) for (var x = X0; x <= X1; x++) if (lumAt(D, (y * SW + x) * 4) <= thr) { n++; sx += x; sy += y; }
      return n ? [sx / n + 0.5, sy / n + 0.5] : [(c.cx + 0.5) * k, (c.cy + 0.5) * k];
    });
  }

  // straighten the sheet at 2 px/mm (±105 × ±114 mm, inside the markers) and find the vinyl there
  function findRecordOnSheet(sd, sheetToPx) {
    var hx = 105, hy = 114, W = hx * 4, H = hy * 4;
    var d = new Uint8ClampedArray(W * H * 4), lum = new Uint8Array(W * H);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var q = sheetToPx(x / 2 - hx, y / 2 - hy);
      var X = Math.min(sd.width - 1, Math.max(0, q[0] | 0)), Y = Math.min(sd.height - 1, Math.max(0, q[1] | 0));
      var i = (Y * sd.width + X) * 4, o = (y * W + x) * 4;
      d[o] = sd.data[i]; d[o + 1] = sd.data[i + 1]; d[o + 2] = sd.data[i + 2]; d[o + 3] = 255;
      lum[y * W + x] = lumAt(d, o) | 0;
    }
    var f = detectEllipse({ width: W, height: H, data: d, lum: lum, thr: otsu(lum) });
    return f ? { x: f.cx / 2 - hx, y: f.cy / 2 - hy, r: (f.a + f.b) / 4 } : null;
  }

  // Hough circle search for the hole within ±10 mm of the outline centre, on a straightened patch at 8 px/mm,
  // for the two standard hole sizes; then a check on the image (share of the circle with a strong radial edge)
  function findHole(sd, toPx) {
    var PX = 8, HALF = 30, S = HALF * 2 * PX, D = sd.data, SW = sd.width, SH = sd.height, x, y, p;
    var lum = new Float32Array(S * S);
    for (y = 0; y < S; y++) for (x = 0; x < S; x++) {
      var q = toPx((x + 0.5) / PX - HALF, (y + 0.5) / PX - HALF);
      var X = Math.min(SW - 1, Math.max(0, q[0] | 0)), Y = Math.min(SH - 1, Math.max(0, q[1] | 0));
      lum[y * S + x] = lumAt(D, (Y * SW + X) * 4);
    }
    var gx = new Float32Array(S * S), gy = new Float32Array(S * S), mag = new Float32Array((S - 2) * (S - 2)), mi = 0;
    for (y = 1; y < S - 1; y++) for (x = 1; x < S - 1; x++) {
      p = y * S + x;
      var a = lum[p - S - 1], b = lum[p - S], c = lum[p - S + 1], d = lum[p - 1], f = lum[p + 1], g = lum[p + S - 1], h = lum[p + S], k = lum[p + S + 1];
      gx[p] = (c + 2 * f + k) - (a + 2 * d + g); gy[p] = (g + 2 * h + k) - (a + 2 * b + c);
      mag[mi++] = Math.hypot(gx[p], gy[p]);
    }
    var sorted = mag.slice().sort(), thr = Math.max(20, sorted[Math.floor(sorted.length * 0.88)]);
    function check(cx, cy, r) {
      var hit = 0, n = 180;
      for (var t = 0; t < n; t++) {
        var ca = Math.cos(t * 2 * Math.PI / n), sa = Math.sin(t * 2 * Math.PI / n);
        for (var dr = -1; dr <= 1; dr++) {
          var xx = Math.round(cx + ca * (r + dr)), yy = Math.round(cy + sa * (r + dr));
          if (xx < 1 || yy < 1 || xx >= S - 1 || yy >= S - 1) continue;
          var pp = yy * S + xx, m = Math.hypot(gx[pp], gy[pp]);
          if (m >= thr && Math.abs((gx[pp] * ca + gy[pp] * sa) / m) > 0.8) { hit++; break; }
        }
      }
      return hit / n;
    }
    var best = null;
    [3.62, 19.1].forEach(function (R) {
      var acc = new Float32Array(S * S), radii = [];
      for (var r = R - 0.6; r <= R + 0.61; r += 0.2) radii.push(r * PX);
      for (var yy = 1; yy < S - 1; yy++) for (var xx = 1; xx < S - 1; xx++) {
        var pp = yy * S + xx, m = Math.hypot(gx[pp], gy[pp]);
        if (m < thr) continue;
        var ux = gx[pp] / m, uy = gy[pp] / m;
        radii.forEach(function (rr) {
          [1, -1].forEach(function (sgn) {
            var cx = Math.round(xx + sgn * ux * rr), cy = Math.round(yy + sgn * uy * rr);
            if (cx >= 0 && cy >= 0 && cx < S && cy < S) acc[cy * S + cx] += 1 / radii.length;
          });
        });
      }
      var lim = 10 * PX, c0 = S / 2, peak = null;
      for (var py = c0 - lim; py <= c0 + lim; py++) for (var px = c0 - lim; px <= c0 + lim; px++) {
        var v = 0; for (var j = -1; j <= 1; j++) for (var i = -1; i <= 1; i++) v += acc[(py + j) * S + px + i];
        if (!peak || v > peak.v) peak = { x: px, y: py, v: v };
      }
      var top = 0, cand = [];
      radii.forEach(function (rr) {
        for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
          var s = check(peak.x + dx, peak.y + dy, rr);
          if (s > top + 1e-9) { top = s; cand = [[peak.x + dx, peak.y + dy, rr]]; }
          else if (Math.abs(s - top) < 1e-9) cand.push([peak.x + dx, peak.y + dy, rr]);
        }
      });
      function mean(k) { return cand.reduce(function (a, c) { return a + c[k]; }, 0) / cand.length; }
      if (!best || top > best.score) best = { x: (mean(0) + 0.5) / PX - HALF, y: (mean(1) + 0.5) / PX - HALF, r: mean(2) / PX, score: top };
    });
    return best && best.score > 0.5 ? best : null;
  }

  // homography from 4 point pairs (DLT, h33 = 1)
  function homography(from, to) {
    var A = [], b = [];
    for (var i = 0; i < 4; i++) {
      var x = from[i][0], y = from[i][1], u = to[i][0], v = to[i][1];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    var h = solve(A, b); h.push(1);
    return h;
  }
  function applyH(h, x, y) {
    var w = h[6] * x + h[7] * y + h[8];
    return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
  }
  function solve(A, b) {
    var n = b.length, m = A.map(function (r, i) { return r.concat([b[i]]); });
    for (var i = 0; i < n; i++) {
      var p = i; for (var r = i + 1; r < n; r++) if (Math.abs(m[r][i]) > Math.abs(m[p][i])) p = r;
      var tmp = m[i]; m[i] = m[p]; m[p] = tmp;
      for (r = 0; r < n; r++) if (r !== i) { var f = m[r][i] / m[i][i]; for (var q = i; q <= n; q++) m[r][q] -= f * m[i][q]; }
    }
    return m.map(function (r, i) { return r[n] / r[i]; });
  }

  /* ── analyse: one photo (ImageData-like) → where the record is ──────────────
     Returns null when no record is found, else { toPx(x mm, y mm) → [px, py] centred on the hole (or the outline),
     sheet: true|false, hole: { r mm } | null, offCentre: 'vertical'|'side'|null, pxPerMm }. */
  function analyse(sd) {
    var toPx = null, sheet = false, offCentre = null;
    var small = downscale(sd, 800);
    var marks = findMarkers(small, sd);
    if (marks) {
      var H = homography(MARKERS, marks);
      var sheetToPx = function (x, y) { return applyH(H, x, y); };
      var det = findRecordOnSheet(sd, sheetToPx);
      if (det) {
        sheet = true;
        toPx = function (x, y) { return sheetToPx(x + det.x, y + det.y); };
        if (Math.abs(det.y) + FULL_MM / 2 > 116.5) offCentre = 'vertical';     // a marker falls inside the Full crop
        else if (Math.abs(det.x) + FULL_MM / 2 > 105) offCentre = 'side';       // the sheet edge falls inside it
      }
    }
    if (!toPx) {
      var s4 = downscale(sd, 400);          // the outline search runs many masks: 400 px is plenty
      var f = detectEllipse(s4);
      if (!f) return null;
      var k = sd.width / s4.width, cx = f.cx * k, cy = f.cy * k;
      var sa = f.a * k / RECORD_R, sb = f.b * k / RECORD_R, co = Math.cos(f.theta), si = Math.sin(f.theta);
      toPx = function (x, y) {               // circle (mm) → ellipse (px)
        var u = x * co + y * si, v = -x * si + y * co, U = u * sa, V = v * sb;
        return [cx + U * co - V * si, cy + U * si + V * co];
      };
    }
    var hole = findHole(sd, toPx);
    if (hole) { var base = toPx; toPx = function (x, y) { return base(x + hole.x, y + hole.y); }; }
    var a = toPx(-10, 0), b = toPx(10, 0);
    return { toPx: toPx, sheet: sheet, hole: hole ? { r: hole.r } : null, offCentre: offCentre,
             pxPerMm: Math.hypot(b[0] - a[0], b[1] - a[1]) / 20 };
  }

  // a square crop of `mm` millimetres centred on the hole, turned by `angle` degrees (clockwise), bilinear
  function crop(sd, an, mm, size, angle) {
    var rr = -(angle || 0) * Math.PI / 180, rc = Math.cos(rr), rs = Math.sin(rr), toPx = an.toPx;
    var o = new Uint8ClampedArray(size * size * 4), D = sd.data, SW = sd.width, SH = sd.height;
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
      var u = ((x + 0.5) / size - 0.5) * mm, v = ((y + 0.5) / size - 0.5) * mm;
      var q = toPx(u * rc - v * rs, u * rs + v * rc);
      var fx = q[0] - 0.5, fy = q[1] - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
      var j = (y * size + x) * 4;
      o[j + 3] = 255;
      if (x0 < 0 || y0 < 0 || x0 + 1 >= SW || y0 + 1 >= SH) { o[j] = o[j + 1] = o[j + 2] = 128; continue; }
      var i00 = (y0 * SW + x0) * 4, i10 = i00 + 4, i01 = i00 + SW * 4, i11 = i01 + 4;
      for (var c = 0; c < 3; c++) o[j + c] = (D[i00 + c] * (1 - ax) + D[i10 + c] * ax) * (1 - ay) + (D[i01 + c] * (1 - ax) + D[i11 + c] * ax) * ay;
    }
    return { width: size, height: size, data: o };
  }

  // the paper around the record (outside 89 mm) on the Full crop, near the median brightness only (skips shadows,
  // the table): one plane per channel. null = no paper there (dark table): the light stays as shot.
  function fitPaper(img) {
    var S = img.width, d = img.data, samples = [];
    function toMM(v) { return (v / S - 0.5) * FULL_MM; }
    var step = Math.max(1, Math.round(S / 266));
    for (var y = 0; y < S; y += step) for (var x = 0; x < S; x += step) {
      var u = toMM(x), v = toMM(y);
      if (u * u + v * v < 89 * 89) continue;
      var i = (y * S + x) * 4;
      samples.push([u, v, d[i], d[i + 1], d[i + 2]]);
    }
    if (samples.length < 200) return null;
    var Ls = samples.map(function (s) { return s[2] + s[3] + s[4]; }).sort(function (a, b) { return a - b; }), med = Ls[Ls.length >> 1];
    if (med < 3 * 110) return null;
    var A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], bv = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], n = 0;
    samples.forEach(function (s) {
      if (Math.abs(s[2] + s[3] + s[4] - med) > med * 0.15) return;
      var f = [1, s[0] / 100, s[1] / 100];
      for (var i = 0; i < 3; i++) { for (var j = 0; j < 3; j++) A[i][j] += f[i] * f[j]; for (var ch = 0; ch < 3; ch++) bv[ch][i] += f[i] * s[2 + ch]; }
      n++;
    });
    if (n < 100) return null;
    return bv.map(function (b) { return solve(A.map(function (r) { return r.slice(); }), b); });
  }
  function evenOut(img, mm, planes) {
    var S = img.width, d = img.data;
    for (var y = 0; y < S; y++) {
      var v = ((y + 0.5) / S - 0.5) * mm / 100;
      for (var x = 0; x < S; x++) {
        var u = ((x + 0.5) / S - 0.5) * mm / 100, i = (y * S + x) * 4;
        for (var c = 0; c < 3; c++) { var p = planes[c]; d[i + c] = d[i + c] * PAPER / Math.max(8, p[0] + p[1] * u + p[2] * v); }
      }
    }
  }

  /* 4. the Scanner look (Gio 2026-11-27: phone photos too bright, too contrasty, too saturated, too sharp). A colour
     transform per camera, fitted on 8 phone/Scanner pairs of the same records (Label crops aligned to the pixel,
     label + vinyl, hole left out). Each output channel = m · [r, g, b, r², g², b², r³, g³, b³, 1], in 0–1: the cubic
     terms bend the tone curve (paper to the Scanner's grey-white, black lifted to the Scanner's dark grey) without
     dulling saturated inks the way a plain matrix does. Median ΔE76 to the scan on records left out of the fit:
     phone 3.6 (from 10–16), live 2.7 (from 11–19). `phone` = the phone's own camera (Create bargain → Phone camera),
     fitted on photos as they come out of the camera; at full resolution it is sharper than the Scanner, so it is
     softened with a Gaussian of `soften` × (1 − 7.4 / photo px per mm) mm: 0 for a photo of ~7 px/mm (already as soft
     as a scan), 0.048 mm (0.8 px of a 1600 px Label) at ~15 px/mm, the iPhone's 12 MP. `live` = the page's camera. */
  var LOOK = {
    phone: { m: [[0.7168, 0.9052, -0.7160, 0.0640, -1.5219, 1.1866, 0.0354, 0.7319, -0.6287, 0.1136], [0.3211, 1.2937, -0.7068, -1.0385, -0.2916, 1.1391, 0.6345, -0.0018, -0.5738, 0.1082], [0.7032, 0.4512, -0.3691, -1.4189, -1.4905, 3.0967, 0.7430, 1.0362, -1.9898, 0.1307]], soften: 0.096 },
    live:  { m: [[0.3518, 0.4871, -0.5573, 1.0418, -1.0953, 1.0452, -0.6220, 0.6663, -0.5625, 0.1347], [-0.0247, 0.9775, -0.6808, 0.1300, -0.4037, 1.2711, -0.1649, 0.3147, -0.6682, 0.1295], [-0.0974, 0.3638, 0.1786, 0.0306, -0.7906, 1.4769, 0.0414, 0.5383, -0.9508, 0.1287]], soften: 0 }
  };
  function scannerLook(img, mm, look, pxPerMm) {
    // the terms are per input channel, so each output channel = 3 lookup tables (r, g, b) + the constant
    var m = look.m, lut = [], d = img.data;
    for (var c = 0; c < 3; c++) for (var ch = 0; ch < 3; ch++) {
      var t = new Float32Array(256);
      for (var n = 0; n < 256; n++) { var x = n / 255; t[n] = 255 * (m[c][ch] * x + m[c][ch + 3] * x * x + m[c][ch + 6] * x * x * x); }
      lut.push(t);
    }
    var k0 = 255 * m[0][9], k1 = 255 * m[1][9], k2 = 255 * m[2][9];
    for (var i = 0; i < d.length; i += 4) {
      var r = d[i], g = d[i + 1], b = d[i + 2];
      d[i] = k0 + lut[0][r] + lut[1][g] + lut[2][b];          // Uint8Clamped clamps
      d[i + 1] = k1 + lut[3][r] + lut[4][g] + lut[5][b];
      d[i + 2] = k2 + lut[6][r] + lut[7][g] + lut[8][b];
    }
    var sigma = look.soften * Math.max(0, 1 - 7.4 / pxPerMm) * img.width / mm;   // mm → px of this crop
    if (sigma >= 0.25) blur(img, sigma);
  }
  function blur(img, sigma) {      // separable Gaussian, RGB only
    var W = img.width, H = img.height, d = img.data, r = Math.ceil(sigma * 3), k = [], sum = 0;
    for (var t = -r; t <= r; t++) { var w = Math.exp(-t * t / (2 * sigma * sigma)); k.push(w); sum += w; }
    k = k.map(function (w) { return w / sum; });
    var tmp = new Float32Array(W * H * 3);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) for (var c = 0; c < 3; c++) {
      var a = 0; for (var j = -r; j <= r; j++) { var xx = Math.min(W - 1, Math.max(0, x + j)); a += k[j + r] * d[(y * W + xx) * 4 + c]; }
      tmp[(y * W + x) * 3 + c] = a;
    }
    for (var y2 = 0; y2 < H; y2++) for (var x2 = 0; x2 < W; x2++) for (var c2 = 0; c2 < 3; c2++) {
      var a2 = 0; for (var j2 = -r; j2 <= r; j2++) { var yy = Math.min(H - 1, Math.max(0, y2 + j2)); a2 += k[j2 + r] * tmp[(yy * W + x2) * 3 + c2]; }
      d[(y2 * W + x2) * 4 + c2] = a2;
    }
  }

  /* 5. the hole's shadow (Gio 2026-11-27): the phone's light casts a dark crescent from the label edge onto what is under
     the hole; the Scanner's flat light barely does. Inside the hole every pixel darker than the hole's own fill (from
     its inner 80 %, 75th percentile) keeps only `HOLE_KEEP` of its darkness: the shadow stays, softer, however far it
     reaches (a lamp far away casts a long one). From 0.5 mm to 0.05 mm before the edge the effect fades out, so the thin
     dark line of the edge itself stays. Then the hole is toned to `HOLE_GREY`, the Scanner's lid seen through the hole
     (median of 8 scans, Gio: "the Scanner's centre is a touch darker"), with the same fade. Runs after the look. */
  var HOLE_KEEP = 0.15, HOLE_GREY = [216, 217, 217];
  function softenHole(img, mm, holeR) {
    var W = img.width, d = img.data, ppm = W / mm, c = W / 2, R = holeR * ppm, inner = 0.8 * R;
    var r0 = Math.max(0, R - 0.5 * ppm), r1 = R - 0.05 * ppm;     // full effect inside r0, none from r1 out
    var x0 = Math.max(0, Math.floor(c - R)), x1 = Math.min(W - 1, Math.ceil(c + R)), x, y, i, ch;
    var fill = [0, 0, 0], vals = [[], [], []];
    for (y = x0; y <= x1; y += 2) for (x = x0; x <= x1; x += 2) {
      if (Math.hypot(x + 0.5 - c, y + 0.5 - c) > inner) continue;
      i = (y * W + x) * 4; for (ch = 0; ch < 3; ch++) vals[ch].push(d[i + ch]);
    }
    if (!vals[0].length) return;
    for (ch = 0; ch < 3; ch++) { var v = vals[ch].sort(function (a, b) { return a - b; }); fill[ch] = v[Math.floor(v.length * 0.75)]; }
    for (y = x0; y <= x1; y++) for (x = x0; x <= x1; x++) {
      var r = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      if (r >= r1) continue;
      var w = r <= r0 ? 1 : (r1 - r) / (r1 - r0);
      i = (y * W + x) * 4;
      for (ch = 0; ch < 3; ch++) {
        var v2 = d[i + ch];
        if (v2 < fill[ch]) v2 += (fill[ch] - v2) * (1 - HOLE_KEEP);
        v2 *= HOLE_GREY[ch] / Math.max(1, fill[ch]);
        d[i + ch] += (v2 - d[i + ch]) * w;
      }
    }
  }

  // both crops at `size` px, turned by `angle`, light evened out (planes fitted on the Full crop, applied to both),
  // then the Scanner look of the camera that took the photo (`camera`: 'live' default | 'phone' | 'none') and, with a
  // look, the hole's shadow softened and the hole toned like the Scanner's
  function render(sd, an, size, angle, camera) {
    var full = crop(sd, an, FULL_MM, size, angle), label = crop(sd, an, LABEL_MM, size, angle);
    var planes = fitPaper(full);
    if (planes) { evenOut(full, FULL_MM, planes); evenOut(label, LABEL_MM, planes); }
    var look = LOOK[camera || 'live'];
    if (look) {
      var a = an.toPx(-10, 0), b = an.toPx(10, 0), pxPerMm = Math.hypot(b[0] - a[0], b[1] - a[1]) / 20;
      scannerLook(full, FULL_MM, look, pxPerMm); scannerLook(label, LABEL_MM, look, pxPerMm);
      if (an.hole) { softenHole(full, FULL_MM, an.hole.r); softenHole(label, LABEL_MM, an.hole.r); }
    }
    return { full: full, label: label, light: !!planes };
  }

  /* the check lines of the page (Figma `check line`, state done | warning), in order: tilt, centre, light, resolution */
  function checks(an, light) {
    var out = [];
    out.push(an.sheet ? { state: 'done', text: 'Sheet found: tilt fixed exactly' }
                      : { state: 'warning', text: 'No sheet: tilt guessed from the record outline' });
    if (an.offCentre) out.push({ state: 'warning', text: an.offCentre === 'vertical' ? 'Record too far up or down on the sheet: a marker shows in Full'
                                                                                      : 'Record too far to the side: the sheet edge shows in Full' });
    out.push(an.hole ? { state: 'done', text: 'Centred on the ' + (an.hole.r > 10 ? 'large' : 'small') + ' hole (Ø ' + (an.hole.r * 2).toFixed(1) + ' mm)' }
                     : { state: 'warning', text: 'Hole not found: centred on the record edge' });
    out.push(light ? { state: 'done', text: 'Light evened out on the paper' }
                   : { state: 'warning', text: 'No paper around the record: light as shot' });
    var labelPx = Math.round(LABEL_MM * an.pxPerMm);
    if (labelPx < OUT * 0.9) out.push({ state: 'warning', text: 'Label enlarged ' + Math.round(OUT / labelPx * 100 - 100) + ' %: shoot a little closer' });
    return out;
  }

  // the live status of the camera: are the sheet's 4 markers in this (small) frame?
  function sheetIn(frame) { return !!findMarkers(downscale(frame, frame.width), frame); }

  // the angle as the turn bar shows it: −180…+180, one decimal, sign
  function angleText(d) { var v = (((d % 360) + 540) % 360) - 180; v = Math.round(v * 10) / 10; return (v > 0 ? '+' : '') + v.toFixed(1) + '°'; }

  return { FULL_MM: FULL_MM, LABEL_MM: LABEL_MM, OUT: OUT, MARKERS: MARKERS, RECORD_R: RECORD_R,
           analyse: analyse, render: render, LOOK: LOOK, sheetIn: sheetIn, checks: checks, angleText: angleText,
           _internal: { downscale: downscale, homography: homography, applyH: applyH, findHole: findHole, detectEllipse: detectEllipse } };
});
