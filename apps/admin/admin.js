/* apps/admin/admin.js — the admin single-page app (React via createElement, no build step).
   Screens: sign-in (email link) · listings (Figma BACKEND → Listings: bulk actions, archive, delete) · create / edit listing (Figma BACKEND → Create)
   · attributes: artists, labels, genres, tags (Figma BACKEND → Attributes) · shipping (Figma BACKEND → Shipping)
   · memo: Gio's reminder list of records to sell later (Figma BACKEND → Memo, decision 0087).
   · bulk: many records at once from named photos and samples, as incomplete drafts (Figma BACKEND → Bulk, decision 0107).
   Data: Supabase with the signed-in user's session (RLS: only public.admins can write).
   Save = one call to public.admin_save_listing (one transaction). Files go straight to R2 through
   short-lived upload URLs from the Edge Function sign-upload; the database keeps only the keys. */
(function () {
  'use strict';
  var React = window.React, h = React.createElement, useState = React.useState, useEffect = React.useEffect, useRef = React.useRef;
  var Z = window.Zanza, CFG = window.ADMIN_CONFIG;
  var sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'implicit' } });

  // ── vocabularies ──────────────────────────────────────────────────────────
  var GRADES = ['M', 'NM', 'NM-', 'EX+', 'EX', 'EX-', 'VG+', 'VG', 'VG-', 'G+', 'G', 'G-', 'F'];   // Q8, table public.grades
  var FORMATS = ['7"', '10"', '12"', 'LP'];
  var MACRO_GENRES = ['Reggae', 'Funk / Soul', 'Hip Hop', 'Electronic', 'Jazz', 'Latin', 'Rock', 'Pop', 'Blues',
                      'Folk, World, & Country', 'Classical', 'Stage & Screen', 'Non-Music', "Children's", 'Brass & Military'];   // Discogs genres = our macro genre (0048)
  var COUNTRIES = [['JA', 'Jamaica'], ['UK', 'UK'], ['US', 'US'], ['CA', 'Canada'], ['DE', 'Germany'], ['FR', 'France'],
                   ['IT', 'Italy'], ['NL', 'Netherlands'], ['JP', 'Japan'], ['Europe', 'Europe'], ['Unknown', 'Unknown']];
  var STATUS_LABEL = { draft: 'Draft', available: 'Available', reserved: 'Reserved', sold: 'Sold', traded: 'Traded', archived: 'Archived' };
  var STATUS_DONE = { draft: 'Unpublished.', available: 'Available again.', reserved: 'Reserved until you release it.', sold: 'Marked as sold.', traded: 'Marked as traded.' };
  var SLEEVES = [['original', 'Original'], ['generic', 'Generic'], ['none', 'None']];

  function mediaUrl(key) {
    if (!key) return '';
    if (/^https?:\/\//.test(key) || key.charAt(0) === '/') return key;
    return CFG.mediaBaseUrl ? CFG.mediaBaseUrl.replace(/\/$/, '') + '/' + key : '';
  }
  function fileNameOf(key) { return String(key || '').split('/').pop(); }
  // a done action whose rows left the view: packages/ui toast.js (decision 0049); the region is rendered at the end of this file
  function toast(message, onUndo) {
    if (!window.ZanzaToast) return;
    window.ZanzaToast.show({ message: message, actionLabel: onUndo ? 'Undo' : null, onAction: onUndo || null });
  }
  var uid = 0;
  function nextId() { return 'u' + (++uid); }
  // the mobile breakpoint, from tokens.json → breakpoint (build.js puts it in config.js): the one place it is decided (0004)
  var MOBILE_QUERY = (CFG.media && CFG.media.mobile) || '(max-width: 767px)';
  function useIsMobile() {
    var mq = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;
    var st = useState(mq ? mq.matches : false), on = st[0], setOn = st[1];
    useEffect(function () {
      if (!mq) return;
      function ch() { setOn(mq.matches); }
      mq.addEventListener ? mq.addEventListener('change', ch) : mq.addListener(ch);
      return function () { mq.removeEventListener ? mq.removeEventListener('change', ch) : mq.removeListener(ch); };
    }, []);
    return on;
  }
  function opts(list) {
    return list.map(function (o) { var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return h('option', { key: v, value: v }, l); });
  }
  function centsToText(c) { return c === null || c === undefined ? '' : (c / 100).toFixed(2).replace(/\.00$/, ''); }
  function textToCents(t) {
    var s = String(t || '').trim().replace(',', '.');
    if (!s) return null;
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
    return Math.round(parseFloat(s) * 100);
  }
  // a checkout hold that has expired counts as available (public.effective_status, migration 0004)
  function effectiveStatus(row) {
    return row.status === 'reserved' && row.reserved_until && new Date(row.reserved_until) <= new Date() ? 'available' : row.status;
  }
  function checkoutUntil(row) {
    return effectiveStatus(row) === 'reserved' && row.stripe_session_id && row.reserved_until ? new Date(row.reserved_until) : null;
  }
  // a release link (…/release/249504-Artist-Title), its number, or Discogs' own [r249504]; a master link is not a release
  function discogsId(t) {
    var s = String(t || '').trim(), m = s.match(/\/release\/(\d+)/) || s.match(/^\[?r?(\d+)\]?$/i);
    return m ? parseInt(m[1], 10) : null;
  }

  // ── uploads ───────────────────────────────────────────────────────────────
  // images: resized in the browser to webp, long side 1600 (backend.md → Storage), plus the smaller copies the shop
  // shows in cards, bag and player (packages/images/images.js, decision 0108)
  var IMG = window.ZanzaImages;
  function loadImage(src, crossOrigin) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      if (crossOrigin) img.crossOrigin = 'anonymous';
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('unreadable')); };
      img.src = src;
    });
  }
  // one webp, long side `long` px at most (never enlarged)
  function webpOf(img, long, name) {
    var scale = Math.min(1, long / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale)); c.height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    return new Promise(function (resolve, reject) {
      c.toBlob(function (b) { b ? resolve({ blob: b, canvas: c }) : reject(new Error('Could not convert ' + name + '.')); }, 'image/webp', 0.86);
    });
  }
  // the smaller copies of one photo, from `img` (the 1600 canvas, or the photo read back from storage)
  async function sizedCopies(img, name) {
    var out = [];
    for (var i = 0; i < IMG.WIDTHS.length; i++) out.push({ width: IMG.WIDTHS[i], blob: (await webpOf(img, IMG.WIDTHS[i], name)).blob });
    return out;
  }
  async function toWebp(file) {
    var url = URL.createObjectURL(file), img;
    try { img = await loadImage(url); }
    catch (e) { throw new Error(file.name + ' is not a readable image.'); }
    finally { URL.revokeObjectURL(url); }
    var full = await webpOf(img, IMG.FULL, file.name);
    return { blob: full.blob, sizes: await sizedCopies(full.canvas, file.name) };
  }
  // the copies go up smallest first, after their photo: the last one existing means they all do (images.js → lastKey)
  async function uploadSizes(key, sizes) {
    for (var i = 0; i < sizes.length; i++) await upload('photo', sizes[i].blob, { of: key, width: sizes[i].width });
  }
  async function uploadPhoto(file, onProgress) {
    var photo = await toWebp(file);
    var key = await upload('photo', photo.blob, null, onProgress);
    // a copy that fails does not lose the photo: the shop then shows the full photo there, Settings → Photo sizes makes it later
    try { await uploadSizes(key, photo.sizes); } catch (e) { console.warn('photo sizes not uploaded for ' + key + ': ' + e.message); }
    return key;
  }

  // samples: an mp3 above ~160 kbps (a 320) is encoded again at 128 kbps in the browser (Gio 2026-11-17, decision 0108),
  // with lamejs (LGPL, loaded only when needed). A 128 stays as it is: encoding it again would only lose quality.
  var SAMPLE_KBPS = 128, SAMPLE_MAX_KBPS = 160;
  var LAME_SRC = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
  var LAME_SRI = 'sha384-xuasJXVcyv3hZq0eYpelEkBC8l4yufatZXDsKuyCU2rqfhDCb+ftuE/mSfZAteiK';
  var lameLoading = null;
  function loadLame() {
    if (window.lamejs) return Promise.resolve(window.lamejs);
    if (!lameLoading) lameLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = LAME_SRC; s.integrity = LAME_SRI; s.crossOrigin = 'anonymous';
      s.onload = function () { window.lamejs ? resolve(window.lamejs) : reject(new Error('mp3 encoder missing')); };
      s.onerror = function () { lameLoading = null; reject(new Error('Could not load the mp3 encoder')); };
      document.head.appendChild(s);
    });
    return lameLoading;
  }
  function toInt16(f32) {
    var out = new Int16Array(f32.length);
    for (var i = 0; i < f32.length; i++) { var v = Math.max(-1, Math.min(1, f32[i])); out[i] = v < 0 ? v * 0x8000 : v * 0x7fff; }
    return out;
  }
  // → { blob, converted, note }: note says why a high-bitrate file goes up as it is (shown to Gio, never silent)
  // onConvert(0–1) while encoding
  async function toSampleMp3(file, onConvert) {
    var same = function (note) { return { blob: file, converted: false, note: note || null }; };
    var Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Ctx) return same('this browser cannot convert audio');
    var audio;
    // decoded at 44.1 kHz whatever the file has, so the encoder always gets a rate it supports
    try { audio = await new Ctx(2, 1, 44100).decodeAudioData(await file.arrayBuffer()); }
    catch (e) { return same('the browser could not read it to convert it'); }
    var kbps = file.size * 8 / audio.duration / 1000;
    if (!(kbps > SAMPLE_MAX_KBPS)) return same();
    var out;
    try { out = await encodeMp3(audio, audio.length, 0, onConvert); } catch (e) { return same('the mp3 encoder did not load'); }
    return out.size < file.size ? { blob: out, converted: true, note: null } : same();
  }
  // the first `frames` of a decoded AudioBuffer → mp3 128 kbps; fadeOut = seconds of fade at the end (a clip, 0 = none)
  async function encodeMp3(audio, frames, fadeOut, onProgress) {
    var lame = await loadLame();
    var channels = Math.min(2, audio.numberOfChannels), n = Math.min(frames, audio.length);
    var fade = Math.min(n, Math.round(fadeOut * audio.sampleRate));
    function pcm(ch) {
      var f32 = audio.getChannelData(ch).subarray(0, n);
      if (!fade) return toInt16(f32);
      var g = new Float32Array(f32);
      for (var i = 0; i < fade; i++) g[n - fade + i] *= 1 - i / fade;
      return toInt16(g);
    }
    var left = pcm(0), right = channels > 1 ? pcm(1) : null;
    var enc = new lame.Mp3Encoder(channels, audio.sampleRate, SAMPLE_KBPS), parts = [], STEP = 1152;
    for (var i = 0; i < left.length; i += STEP) {
      var b = right ? enc.encodeBuffer(left.subarray(i, i + STEP), right.subarray(i, i + STEP)) : enc.encodeBuffer(left.subarray(i, i + STEP));
      if (b.length) parts.push(new Uint8Array(b));
      if (i % (STEP * 400) === 0) {   // keep the page responsive, report progress
        if (onProgress) onProgress(i / left.length);
        await new Promise(function (r) { setTimeout(r, 0); });
      }
    }
    var end = enc.flush();
    if (end.length) parts.push(new Uint8Array(end));
    return new Blob(parts, { type: 'audio/mpeg' });
  }
  // a clip of a sample (Gio 2026-11-17, decision 0110): its first `seconds`, a hard cut (no fade-in nor fade-out, Gio), 128 kbps.
  // source = the File Gio dropped (best quality) or the URL of the file already in storage. onState as uploadFile.
  var CLIP_FADE_OUT = 0, CLIP_DEFAULT = 45;
  async function clipSample(source, seconds, onState) {
    var report = onState || function () {};
    report({ phase: 'cutting', value: 0 });
    var data = source instanceof Blob ? await source.arrayBuffer() : await (await fetch(source)).arrayBuffer();
    var Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var audio = await new Ctx(2, 1, 44100).decodeAudioData(data);
    var blob = await encodeMp3(audio, Math.round(seconds * audio.sampleRate), CLIP_FADE_OUT, function (f) { report({ phase: 'cutting', value: Math.round(f * 60) }); });
    report({ phase: 'uploading', value: 60 });
    var key = await upload('sample', blob, null, function (f) { report({ phase: 'uploading', value: Math.round(60 + f * 40) }); });
    return { key: key, blob: blob, duration: Math.min(seconds, audio.duration) };
  }
  // one file of the form or of Bulk → its storage key. onState({ phase: 'converting' | 'uploading', value: 0–100 })
  // drives the file's ProgressBar: a sample that is converted counts 0–60 converting, 60–100 uploading; anything else
  // 0–100 uploading. onNote(text) when a high-bitrate sample goes up as it is.
  function uploadFile(kind, file, onState, onNote) {
    var report = onState || function () {};
    report({ phase: kind === 'sample' ? 'converting' : 'uploading', value: 0 });
    if (kind === 'photo') return uploadPhoto(file, function (f) { report({ phase: 'uploading', value: Math.round(f * 100) }); });
    return toSampleMp3(file, function (f) { report({ phase: 'converting', value: Math.round(f * 60) }); }).then(function (r) {
      if (r.note && onNote) onNote(file.name + ' stays at its original bitrate (not 128 kbps): ' + r.note + '.');
      var base = r.converted ? 60 : 0;
      report({ phase: 'uploading', value: base });
      return upload('sample', r.blob, null, function (f) { report({ phase: 'uploading', value: Math.round(base + f * (100 - base)) }); });
    });
  }
  var PHASE_TEXT = { converting: 'converting to 128 kbps…', cutting: 'cutting…', uploading: 'uploading…' };
  function mmss(sec) { var t = Math.round(sec); return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2); }
  // calls an Edge Function; its own { error } text wins over the generic "non-2xx" message
  async function invoke(name, body) {
    var res = await sb.functions.invoke(name, { body: body });
    if (res.error) {
      var msg = res.error.message;
      try { var j = await res.error.context.json(); if (j && j.error) msg = j.error; } catch (e) { /* keep the generic message */ }
      throw new Error(msg);
    }
    return res.data;
  }
  // PUT with upload progress (fetch has none): onProgress(0–1)
  function putWithProgress(url, blob, onProgress) {
    return new Promise(function (resolve, reject) {
      var x = new XMLHttpRequest();
      x.open('PUT', url);
      x.setRequestHeader('Content-Type', blob.type);
      if (onProgress) x.upload.onprogress = function (e) { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      x.onload = function () { resolve({ ok: x.status >= 200 && x.status < 300, status: x.status }); };
      x.onerror = function () { reject(new Error('network')); };
      x.send(blob);
    });
  }
  // sized = { of: photo key, width } for a smaller copy of that photo (decision 0108); onProgress(0–1) of this file
  async function upload(kind, blob, sized, onProgress) {
    var signed = await invoke('sign-upload', Object.assign({ kind: kind, contentType: blob.type, size: blob.size }, sized || {}));
    // a sign-upload older than 0108 ignores { of, width } and signs a random key: upload nothing then
    if (sized && signed.key !== IMG.sizedKey(sized.of, sized.width)) throw new Error('Photo sizes need the new sign-upload function (decision 0108).');
    var put;
    try { put = await putWithProgress(signed.uploadUrl, blob, onProgress); }
    catch (e) { throw new Error('Storage refused the upload without details (R2 sends no CORS headers on errors): check the R2 keys and the bucket CORS policy.'); }
    if (!put.ok) throw new Error('Upload refused by storage (' + put.status + ').');
    return signed.key;
  }

  // ── artists, labels, genres and tags are entities (migrations 0006, 0007, 0011, 0014) ─────
  // Each field is a chip field (Z.EntityField, decision 0020): a chip = an entity { id, name } (id null = new,
  // created on save). Artist and Label also have "Different spelling" → the name AS PRINTED on this record
  // (credit); the database learns it as an alias of the official name. Binding on save: id → Discogs id →
  // official name or alias → new entity.
  function newLine(p) { return Object.assign({ id: nextId(), artists: [], artistCredit: '', artistSpelled: false, title: '' }, p); }
  function chip(e) { return { id: e.id || null, name: e.name, discogsId: e.discogsId || null }; }
  function namesOf(chips) { return (chips || []).map(function (c) { return c.name; }).join(' & '); }
  // entities = { artists | labels | genres | tags: [{ id, name, aliases: [] }] }, loaded once per form
  function findEntity(list, text) {
    var t = String(text || '').trim().toLowerCase();
    if (!t || !list) return null;
    for (var i = 0; i < list.length; i++) if (list[i].name.toLowerCase() === t) return list[i];
    return null;
  }
  function differs(a, b) { return !!a && !!b && a.trim().toLowerCase() !== b.trim().toLowerCase(); }
  function loadEntities() {
    function one(table, aliases) {
      return sb.from(table).select('id,name' + (aliases ? ',' + aliases + '(name)' : '')).order('name').then(function (res) {
        if (res.error) throw new Error(res.error.message);
        return res.data.map(function (e) { return { id: e.id, name: e.name, aliases: aliases ? (e[aliases] || []).map(function (a) { return a.name; }) : [] }; });
      });
    }
    return Promise.all([one('artists', 'artist_aliases'), one('labels', 'label_aliases'), one('genres'), one('tags')])
      .then(function (r) { return { artists: r[0], labels: r[1], genres: r[2], tags: r[3] }; });
  }

  // ── empty form ────────────────────────────────────────────────────────────
  function emptyForm() {
    return {
      listingId: null, sku: null, status: 'draft', slug: null, checkoutUntil: null, soldAt: null,
      customTitle: '', discogs: '', catNo: '',
      lines: [newLine()],
      label: [], labelCredit: '', labelSpelled: false, preRelease: false, country: '', year: '', format: '', section: 'sale', price: '',
      macroGenre: '', genres: [], tags: [],   // macro genre = a Discogs genre (Reggae), not shown in the shop; genres = Discogs styles (0048); tags = the shop's own (Rare, Killer version...)
      condition: '', conditionB: '', conditionNotes: '', sleeveType: 'generic', sleeveCondition: '',
      notes: '',
      images: [],    // { id, key, name, url, uploading }
      samples: []    // { id, key, name, url, line (1-based) | null, uploading }
    };
  }
  function formFromRow(row) {
    var f = emptyForm(), r = row.release || {};
    var lines = (r.lines || []).slice().sort(function (a, b) { return a.position - b.position; });
    var lineIdToPos = {};
    lines.forEach(function (l) { lineIdToPos[l.id] = l.position; });
    f.listingId = row.id; f.sku = row.sku; f.status = effectiveStatus(row); f.slug = row.slug;
    f.checkoutUntil = checkoutUntil(row); f.soldAt = row.sold_at;
    f.customTitle = row.custom_title || ''; f.discogs = r.discogs_release_id ? String(r.discogs_release_id) : '';
    f.catNo = r.cat_no || '';
    // the field shows the official name; the stored text is the credit (Different spelling when it differs)
    f.lines = lines.length ? lines.map(function (l) {
      var artists = (l.credits || []).slice().sort(function (a, b) { return a.position - b.position; })
        .map(function (c) { return chip(c.artist); });
      // a line without entity rows (older data) keeps its text as one new chip
      if (!artists.length && l.artist) artists = [{ id: null, name: l.artist }];
      var spelled = artists.length > 0 && differs(l.artist, namesOf(artists));
      return newLine({ artists: artists, artistCredit: spelled ? l.artist : '', artistSpelled: spelled, title: l.title || '' });
    }) : f.lines;
    var le = r.label_entity;
    f.label = le ? [chip(le)] : r.label ? [{ id: null, name: r.label }] : [];
    f.preRelease = !!r.pre_release;
    f.labelSpelled = !!le && differs(r.label, le.name); f.labelCredit = f.labelSpelled ? r.label : ''; f.country = r.country || ''; f.year = yearText(r.year, r.year_precision); f.format = r.format || '';
    f.section = row.section; f.price = centsToText(row.price_cents);
    var byPos = function (a, b) { return a.position - b.position; };
    var genreRows = (r.genre_rows || []).slice().sort(byPos);
    f.genres = genreRows.length ? genreRows.map(function (t) { return chip(t.genre); }) : (r.genres || []).map(function (n) { return { id: null, name: n }; });
    f.tags = (r.tag_rows || []).slice().sort(byPos).map(function (t) { return chip(t.tag); });
    f.macroGenre = (r.macro_genre || [])[0] || '';
    f.condition = row.condition_media || ''; f.conditionB = row.condition_media_b || ''; f.conditionNotes = row.condition_notes || '';
    f.sleeveType = row.sleeve_type || 'original'; f.sleeveCondition = row.condition_sleeve || '';
    f.notes = row.notes || '';
    f.images = (row.photo_keys || []).map(function (k) { return { id: nextId(), key: k, name: fileNameOf(k), url: mediaUrl(k) }; });
    f.samples = (r.samples || []).slice().sort(function (a, b) { return a.sort - b.sort; }).map(function (s) {
      return { id: nextId(), key: s.audio_key, name: fileNameOf(s.audio_key), title: s.title, url: mediaUrl(s.audio_key), line: s.line_id ? lineIdToPos[s.line_id] || null : null };
    });
    return f;
  }

  // ── Discogs → form (Edge Function discogs-lookup) ─────────────────────────
  // Fills the release fields only; price, condition, notes, photos and samples stay as they are.
  // Returns the patch and the Discogs values the form vocabularies could not take.
  function formatOf(fmt) {
    var d = (fmt && fmt.descriptions) || [];
    if (d.indexOf('LP') >= 0) return 'LP';
    for (var i = 0; i < FORMATS.length; i++) if (d.indexOf(FORMATS[i]) >= 0) return FORMATS[i];
    return '';
  }
  function patchFromDiscogs(cur, d, entities) {
    var skipped = [];
    var tracks = (d.tracks || []).filter(function (t) { return t.title; });
    // one chip per Discogs artist (official name; its Discogs id binds the right entity on save) + the line as printed
    function chipsOf(list) {
      return (list || []).map(function (a) {
        var m = findEntity(entities && entities.artists, a.name);
        return { id: m ? m.id : null, name: a.name, discogsId: a.discogsId || null };
      });
    }
    var first = tracks.length ? tracks[0].artist : d.artist;
    var lines = tracks.length
      ? tracks.map(function (t, i) {
          if (i > 0 && t.artist === first) return newLine({ title: t.title });   // same as line 1: left empty
          var spelled = differs(t.artistCredit, t.artist);
          return newLine({ artists: chipsOf(t.artists || [{ name: t.artist, discogsId: t.artistDiscogsId }]),
                           artistCredit: spelled ? t.artistCredit : '', artistSpelled: spelled, title: t.title });
        })
      : cur.lines;
    // samples keep their line; a line that no longer exists turns them into additional samples
    var samples = cur.samples.map(function (s) { return s.line && s.line > lines.length ? Object.assign({}, s, { line: null }) : s; });
    var country = COUNTRIES.filter(function (c) { return c[1] === d.country; })[0];
    if (d.country && !country) skipped.push('country ' + d.country);
    var format = formatOf(d.format);
    if (!format) skipped.push('format ' + [d.format && d.format.name].concat((d.format && d.format.descriptions) || []).filter(Boolean).join(' '));
    // Discogs: genres → our macro genre (one), styles → our genres (0048)
    var macroGenre = (d.genres || []).filter(function (g) { return MACRO_GENRES.indexOf(g) >= 0; })[0] || '';
    if ((d.genres || []).length > 1) skipped.push('other macro genres ' + d.genres.filter(function (g) { return g !== macroGenre; }).join(', '));
    return {
      patch: {
        discogs: String(d.releaseId), lines: lines, samples: samples,
        label: d.label ? [{ id: (findEntity(entities && entities.labels, d.label) || {}).id || null, name: d.label, discogsId: d.labelDiscogsId || null }] : [],
        labelCredit: '', labelSpelled: false, catNo: d.catNo || '', year: d.year ? String(d.year) : '',
        country: country ? country[0] : '', format: format, macroGenre: macroGenre,
        genres: (d.styles || []).map(function (n) { return { id: (findEntity(entities && entities.genres, n) || {}).id || null, name: n }; })
      },
      skipped: skipped
    };
  }

  // ── validation: what the database needs (format, condition, line 1, price for sale) ──
  // A draft needs only the line titles (decision 0107: bulk drafts are born incomplete); the rest is asked on publish.
  // Year field (decision 0082): an exact year ("1983") or a decade ("1990s", stored as 1990 + year_precision 'decade')
  function parseYear(text) {
    var m = /^((?:19|20)\d\d)$/.exec(text.trim()) || /^((?:19|20)\d0)s$/i.exec(text.trim());
    if (!m) return null;
    return { year: m[1], precision: /s$/i.test(text.trim()) ? 'decade' : 'year' };
  }
  function yearText(year, precision) { return year ? String(year) + (precision === 'decade' ? 's' : '') : ''; }
  function validate(f, status) {
    var e = {}, publish = status !== 'draft';
    if (publish && !f.lines[0].artists.length) e['artist-0'] = 'Pick or create the artist.';
    f.lines.forEach(function (l, i) { if (!l.title.trim()) e['title-' + i] = 'Enter the title.'; });
    if (publish && !f.format) e.format = 'Choose a format.';
    if (publish && !f.condition) e.condition = 'Choose the condition of side A.';
    var cents = textToCents(f.price);
    if (publish && f.section === 'sale' && cents === null) e.price = 'Enter a price.';
    else if (Number.isNaN(cents)) e.price = 'Use a number, e.g. 12 or 12.50.';
    if (f.year.trim() && !parseYear(f.year)) e.year = 'Use a year (1983) or a decade (1990s).';
    if (f.discogs && discogsId(f.discogs) === null) e.discogs = 'Paste a Discogs release URL or its number.';
    if (f.images.some(function (x) { return x.uploading; }) || f.samples.some(function (x) { return x.uploading; })) e.uploads = 'Wait for the uploads to finish.';
    return e;
  }
  function payloadOf(f, status) {
    return {
      listing_id: f.listingId,
      release: {
        discogs_release_id: f.discogs ? discogsId(f.discogs) : null,
        label: f.label.length ? f.label[0].name : '', label_credit: f.labelSpelled ? f.labelCredit : '',
        pre_release: f.preRelease,
        label_id: f.label.length ? f.label[0].id : null, label_discogs_id: f.label.length ? f.label[0].discogsId || null : null, cat_no: f.catNo, year: (parseYear(f.year) || {}).year || '', year_precision: (parseYear(f.year) || {}).precision || 'year', country: f.country, format: f.format,
        macro_genre: f.macroGenre ? [f.macroGenre] : [],
        genres: f.genres.map(function (t) { return { id: t.id, name: t.name }; }),
        tags: f.tags.map(function (t) { return { id: t.id, name: t.name }; })
      },
      lines: f.lines.map(function (l) {
        return { artist: namesOf(l.artists), artist_credit: l.artistSpelled ? l.artistCredit : '', title: l.title,
                 artists: l.artists.map(function (a) { return { id: a.id, name: a.name, discogs_id: a.discogsId || null }; }) };
      }),
      listing: {
        section: f.section, status: status, price_cents: textToCents(f.price),
        condition_media: f.condition, condition_media_b: f.conditionB, condition_notes: f.conditionNotes,
        sleeve_type: f.sleeveType, condition_sleeve: f.sleeveType === 'none' ? '' : f.sleeveCondition,
        notes: f.notes, custom_title: f.customTitle,
        photo_keys: f.images.map(function (x) { return x.key; })
      },
      // only a title typed by Gio is stored; without it the shop shows the line title (data/products.js)
      samples: f.samples.map(function (s) { return { line: s.line, audio_key: s.key, title: s.title || '' }; })
    };
  }

  // ── shop preview: form → the storefront's text (same mapping as apps/storefront/pages/shell.js and data/products.js) ──
  // the shop shows the credit when it differs (Different spelling), as the database stores it
  function lineArtistText(l) { return l.artistSpelled && l.artistCredit.trim() ? l.artistCredit.trim() : namesOf(l.artists); }
  // "Artist - Title 1 / Title 2", or "Artist 1 - Title 1 / Artist 2 - Title 2" when a later line has its own artist;
  // tolerant of half-filled lines (the preview fills in while typing)
  function previewName(f) {
    if (f.customTitle.trim()) return f.customTitle.trim();
    var ls = f.lines.map(function (l) { return { artist: lineArtistText(l), title: l.title.trim() }; });
    var first = ls[0].artist;
    function join(a, t) { return [a, t].filter(Boolean).join(' - '); }
    var own = ls.slice(1).some(function (l) { return l.artist && l.artist !== first; });
    if (!own) return join(first, ls.map(function (l) { return l.title; }).filter(Boolean).join(' / '));
    return ls.map(function (l) { return join(l.artist || first, l.title); }).filter(Boolean).join(' / ');
  }
  function previewReleaseInfo(f) {
    var label = f.labelSpelled && f.labelCredit.trim() ? f.labelCredit.trim() : (f.label[0] || {}).name;
    return [label, label && f.preRelease ? 'Pre' : null, f.format, f.country ? '(' + f.country + ')' : null].filter(Boolean).join(' ');
  }
  function previewPrice(f) {
    var c = f.section === 'sale' ? textToCents(f.price) : null;
    return c === null || c === undefined || isNaN(c) ? null : (c % 100 === 0 ? c / 100 : (c / 100).toFixed(2)) + '€';
  }
  // PDP: one tag group, genres then tags
  function previewTags(f) { return (f.genres || []).concat(f.tags || []).map(function (t) { return t.name; }); }

  // ── Create / edit listing ─────────────────────────────────────────────────
  function ListingForm(props) {
    var mobile = useIsMobile();
    var tradeOn = useTradeEnabled();   // trade off (Settings, decision 0102): "For trade" only for a listing that already is one
    var st = useState(props.initial), f = st[0], setF = st[1];
    var er = useState({}), errors = er[0], setErrors = er[1];
    var ms = useState(null), message = ms[0], setMessage = ms[1];
    var sv = useState(false), saving = sv[0], setSaving = sv[1];
    var pl = useState(null), playing = pl[0], setPlaying = pl[1];
    // the shop's Player docked at the bottom (Gio 2026-11-17): opens on the first play, its native audio element plays
    var op = useState(null), openId = op[0], setOpenId = op[1];
    var audioRef = useRef(null), openRef = useRef(null), loadedUrl = useRef(null), playerRef = useRef(null);
    openRef.current = openId;
    function stopAudio() { if (audioRef.current) audioRef.current.pause(); }
    useEffect(function () {   // the play buttons follow the audio element, also when it is paused from its own controls
      var a = audioRef.current;
      if (!a) return;
      function on() { setPlaying(openRef.current); }
      function off() { setPlaying(null); }
      a.addEventListener('play', on); a.addEventListener('pause', off); a.addEventListener('ended', off);
      return function () { a.removeEventListener('play', on); a.removeEventListener('pause', off); a.removeEventListener('ended', off); stopAudio(); };
    }, []);
    useEffect(function () {   // while it is open, the page and the mobile ActionBar keep clear of it
      var root = document.documentElement;
      if (!openId || !playerRef.current) { root.style.removeProperty('--admin-player-height'); document.body.removeAttribute('data-player-open'); return; }
      root.style.setProperty('--admin-player-height', playerRef.current.offsetHeight + 'px');
      document.body.setAttribute('data-player-open', '');
    }, [openId, mobile]);
    useEffect(function () { return function () { document.documentElement.style.removeProperty('--admin-player-height'); document.body.removeAttribute('data-player-open'); }; }, []);
    var fRef = useRef(f); fRef.current = f;
    var fd = useState(false), fetching = fd[0], setFetching = fd[1];
    var pf = useState(null), photoFound = pf[0], setPhotoFound = pf[1];   // releases from a photo of the label (0092)
    var en = useState(null), entities = en[0], setEntities = en[1];
    useEffect(function () {
      loadEntities().then(setEntities).catch(function (err) { setMessage({ error: true, text: 'Suggestions not loaded: ' + err.message }); });
    }, []);
    // opened from the Memo list (0087): the release is fetched once the suggestions are in (chips bind to entities);
    // a free-text item only names the record in the status line. The first save takes the item off the list.
    var fromMemo = props.fromMemo || null;
    var tookOff = useRef(false), autoFetched = useRef(false);
    useEffect(function () {
      if (!fromMemo) return;
      if (!fromMemo.discogs) { setMessage({ error: false, text: 'From Memo: ' + fromMemo.title + (fromMemo.note ? ' (' + fromMemo.note + ')' : '') + '. No Discogs release: fill in the record.' }); return; }
      if (autoFetched.current || entities === null) return;
      autoFetched.current = true;
      fetchDiscogs();
    }, [entities]);

    function set(patch) { setF(function (cur) { return Object.assign({}, cur, typeof patch === 'function' ? patch(cur) : patch); }); }
    function bind(name) {
      return { value: f[name], onChange: function (e) { var p = {}; p[name] = e.target.value; set(p); }, error: errors[name] };
    }
    function setLine(i, key, value) {
      set(function (cur) { var lines = cur.lines.slice(); lines[i] = Object.assign({}, lines[i]); lines[i][key] = value; return { lines: lines }; });
    }
    function addLine() { set(function (cur) { return { lines: cur.lines.concat([newLine()]) }; }); }
    // chips changed; an alias picked becomes the official chip with the alias as Different spelling
    // (only for a single artist: a printed "A & B" is one credit for the whole line)
    function setLineArtists(i, chips, info) {
      set(function (cur) {
        var lines = cur.lines.slice(), patch = { artists: chips };
        if (info && info.alias && chips.length === 1) { patch.artistSpelled = true; patch.artistCredit = lines[i].artistCredit || info.alias; }
        lines[i] = Object.assign({}, lines[i], patch);
        return { lines: lines };
      });
    }
    function setLabel(chips, info) {
      set(function (cur) {
        var patch = { label: chips };
        if (info && info.alias) { patch.labelSpelled = true; patch.labelCredit = cur.labelCredit || info.alias; }
        return patch;
      });
    }
    function removeLine(i) {
      // the line's samples are kept as "additional" samples (line null); later lines move up by one
      set(function (cur) {
        var lines = cur.lines.filter(function (_, j) { return j !== i; });
        var samples = cur.samples.map(function (s) {
          if (s.line === i + 1) return Object.assign({}, s, { line: null });
          if (s.line > i + 1) return Object.assign({}, s, { line: s.line - 1 });
          return s;
        });
        return { lines: lines, samples: samples };
      });
    }
    function moveIn(listName) {
      return function (from, to) { set(function (cur) { var n = cur[listName].slice(); n.splice(to, 0, n.splice(from, 1)[0]); var p = {}; p[listName] = n; return p; }); };
    }
    function removeFrom(listName, id) {
      return function () {
        if (openId === id) closePlayer();
        set(function (cur) { var p = {}; p[listName] = cur[listName].filter(function (x) { return x.id !== id; }); return p; });
      };
    }
    function patchItem(listName, id, patch) {
      set(function (cur) { var p = {}; p[listName] = cur[listName].map(function (x) { return x.id === id ? Object.assign({}, x, patch) : x; }); return p; });
    }
    function playable() { return f.samples.filter(function (x) { return x.url && !x.uploading; }); }
    function togglePlay(s) {
      var a = audioRef.current;
      if (!s || !s.url || !a) return;
      if (openId === s.id && !a.paused) { a.pause(); return; }
      if (loadedUrl.current !== s.url) { a.src = s.url; loadedUrl.current = s.url; }
      openRef.current = s.id; setOpenId(s.id);
      a.play().catch(function () {});
    }
    function closePlayer() {
      stopAudio(); setOpenId(null); setPlaying(null);
      if (audioRef.current) { audioRef.current.removeAttribute('src'); audioRef.current.load(); }
      loadedUrl.current = null;
    }
    function addFiles(kind, line) {
      return function (files) {
        var wanted = files.filter(function (file) { return kind === 'photo' ? /^image\//.test(file.type) : file.type === 'audio/mpeg'; });
        if (wanted.length < files.length) setMessage({ error: true, text: (files.length - wanted.length) + ' file(s) skipped: ' + (kind === 'photo' ? 'images only (jpg, png, webp).' : 'samples must be mp3.') });
        // one sample per line (Gio, 2026-11-10): more go in the samples overview as additional samples
        if (kind === 'sample' && line && wanted.length > 1) {
          setMessage({ error: true, text: 'One sample per line: ' + (wanted.length - 1) + ' file(s) skipped. Add more in Samples overview.' });
          wanted = wanted.slice(0, 1);
        }
        wanted.forEach(function (file) {
          var item = { id: nextId(), key: null, name: file.name, url: URL.createObjectURL(file), uploading: true, line: line === undefined ? null : line,
                       file: kind === 'sample' ? file : undefined };   // a sample keeps its original: a clip is cut from it (0110)
          var listName = kind === 'photo' ? 'images' : 'samples';
          set(function (cur) { var p = {}; p[listName] = cur[listName].concat([item]); return p; });
          uploadFile(kind, file, function (st) { patchItem(listName, item.id, { phase: st.phase, progress: st.value }); },
            function (note) { setMessage({ error: true, text: note }); })
            .then(function (key) { patchItem(listName, item.id, { key: key, uploading: false, phase: null, progress: null }); })
            .catch(function (err) {
              set(function (cur) { var p = {}; p[listName] = cur[listName].filter(function (x) { return x.id !== item.id; }); return p; });
              setMessage({ error: true, text: file.name + ': ' + err.message });
            });
        });
      };
    }
    async function save(status) {
      var cur = fRef.current, e = validate(cur, status);
      setErrors(e);
      if (Object.keys(e).length) {
        setMessage({ error: true, text: e.uploads || 'Check the highlighted fields.' });
        return;
      }
      setSaving(true); setMessage(null);
      var res = await sb.rpc('admin_save_listing', { payload: payloadOf(cur, status) });
      setSaving(false);
      if (res.error) { setMessage({ error: true, text: 'Not saved: ' + res.error.message }); return; }
      var d = res.data;
      set({ listingId: d.listing_id, sku: d.sku, status: d.status, slug: d.slug });
      if (fromMemo && !tookOff.current) {
        tookOff.current = true;
        sb.from('memos').delete().eq('id', fromMemo.id).then(function (r) {
          toast(r.error ? 'Still on Memo: ' + r.error.message : 'Taken off Memo.');
        });
      }
      setMessage({ error: false, text: d.status === 'available'
        ? 'Published · SKU ' + d.sku + '. The shop updates in about 2 minutes.'
        : 'Saved as draft · SKU ' + d.sku + '.' });
      if (!cur.listingId) history.replaceState(null, '', '#edit-' + d.listing_id);
    }

    // Fetch Discogs: reads the release in "Discogs match" and fills the release fields
    async function fetchDiscogs(picked) {
      if (fetching) return;
      var id = typeof picked === 'number' ? picked : discogsId(fRef.current.discogs);
      if (id === null) {
        setErrors(function (cur) { return Object.assign({}, cur, { discogs: 'Paste a Discogs release URL or its number.' }); });
        return;
      }
      setErrors(function (cur) { var n = Object.assign({}, cur); delete n.discogs; return n; });
      setFetching(true); setMessage({ error: false, text: 'Reading Discogs…' });
      try {
        var d = await invoke('discogs-lookup', { releaseId: id });
        var r = patchFromDiscogs(fRef.current, d, entities);
        set(r.patch);
        setMessage({ error: false, text: 'Filled from Discogs: check the fields before saving.' + (r.skipped.length ? ' Not filled: ' + r.skipped.join('; ') + '.' : '') });
      } catch (err) {
        setMessage({ error: true, text: 'Discogs: ' + err.message });
      }
      setFetching(false);
    }

    // From Discogs (0111): Custom title = the release as Discogs titles it, "Artist - Title" (the artist as printed).
    // Only the title changes; the shop links the release's artists found in it.
    var tt = useState(false), titling = tt[0], setTitling = tt[1];
    async function titleFromDiscogs() {
      var id = discogsId(fRef.current.discogs);
      if (id === null || titling) return;
      setTitling(true);
      try {
        var d = await invoke('discogs-lookup', { releaseId: id });
        var title = [d.artistCredit || d.artist, d.title].filter(Boolean).join(' - ');
        if (!title) throw new Error('the release has no title');
        set({ customTitle: title });
        setMessage({ error: false, text: 'Custom title from Discogs: ' + title + '.' });
      } catch (err) {
        setMessage({ error: true, text: 'Discogs: ' + err.message });
      }
      setTitling(false);
    }

    // manual status changes (admin_set_status): sold elsewhere, held for someone, unpublished, undo
    var nt = useState(''), statusNote = nt[0], setStatusNote = nt[1];
    async function setStatus(status) {
      setSaving(true); setMessage(null);
      var res = await sb.rpc('admin_set_status', { p_listing_id: f.listingId, p_status: status, p_note: statusNote || null });
      setSaving(false);
      if (res.error) { setMessage({ error: true, text: 'Status not changed: ' + res.error.message }); return; }
      set({ status: res.data.status, soldAt: res.data.sold_at, checkoutUntil: null });
      setStatusNote('');
      setMessage({ error: false, text: STATUS_DONE[res.data.status] + ' The shop updates in about 2 minutes.' });
    }
    // archived copies come back only through admin_bulk_status (0009), to the status they had
    async function restore() {
      setSaving(true); setMessage(null);
      var res = await sb.rpc('admin_bulk_status', { p_ids: [f.listingId], p_action: 'restore', p_note: statusNote || null });
      setSaving(false);
      var done = !res.error && res.data.done[0];
      if (!done) { setMessage({ error: true, text: 'Not restored: ' + (res.error ? res.error.message : 'it is no longer archived.') }); return; }
      set({ status: done.to });
      setStatusNote('');
      setMessage({ error: false, text: 'Restored as ' + (STATUS_LABEL[done.to] || done.to).toLowerCase() + '.' });
    }

    // while it uploads (or converts, samples): the phase after the name and a ProgressBar under the row (Gio 2026-11-17,
    // decision 0108). Real progress: encoding frames, then bytes sent.
    function fileItem(listName, x, extra, children) {
      var bar = x.uploading ? h(Z.ProgressBar, { key: 'progress', value: x.progress || 0,
        'aria-label': (x.phase === 'converting' ? 'Converting ' : 'Uploading ') + x.name }) : null;
      return h(Z.FileItem, Object.assign({
        key: x.id, name: x.uploading ? x.name + ' · ' + (PHASE_TEXT[x.phase] || PHASE_TEXT.uploading) : x.name,
        onRemove: removeFrom(listName, x.id)
      }, extra), children || bar ? h(React.Fragment, null, children || null, bar) : null);
    }
    function sampleItem(s) {
      return fileItem('samples', s, { playing: playing === s.id, onTogglePlay: function () { togglePlay(s); } });
    }
    // samples overview (Figma 2095:20507): the title shown next to the play button in the shop.
    // Prefilled with the line title until Gio types one; empty for additional samples.
    function sampleTitleOf(s) {
      if (s.title != null) return s.title;
      var l = s.line ? f.lines[s.line - 1] : null;
      return l ? l.title || '' : '';
    }
    // ── clip a sample (Gio 2026-11-17, decision 0110) ──
    // Length Full = the file as uploaded; Clip = its first N seconds (default 45), cut here as soon as it is chosen, with
    // no fade (Gio), and uploaded as a new file (the play button then plays the clip). Back to Full restores the file it
    // was cut from. The database keeps only the file in use; a replaced one goes to the media trash on save.
    useEffect(function () {   // how long each sample is, for the row and the Clip check
      f.samples.forEach(function (x) {
        if (x.duration != null || !x.url || x.uploading) return;
        var a = new Audio(); a.preload = 'metadata';
        a.onloadedmetadata = function () { patchItem('samples', x.id, { duration: a.duration }); };
        a.onerror = function () { patchItem('samples', x.id, { duration: 0 }); };
        a.src = x.url;
      });
    }, [f.samples.map(function (x) { return x.id + (x.url || '') + (x.uploading ? 1 : 0); }).join()]);
    function applyClip(x, seconds) {
      var full = x.full || { key: x.key, url: x.url, duration: x.duration, file: x.file };
      if (!(seconds > 0)) { setMessage({ error: true, text: x.name + ': the clip length is a number of seconds, like 45.' }); return; }
      if (full.duration && seconds >= full.duration) { setMessage({ error: true, text: x.name + ' is ' + mmss(full.duration) + ' long: nothing to cut at ' + seconds + ' s.' }); return; }
      if (openId === x.id) stopAudio();
      patchItem('samples', x.id, { full: full, length: 'clip', clipSeconds: seconds, uploading: true, phase: 'cutting', progress: 0 });
      clipSample(full.file || full.url, seconds, function (st) { patchItem('samples', x.id, { phase: st.phase, progress: st.value }); })
        .then(function (r) {
          patchItem('samples', x.id, { key: r.key, url: URL.createObjectURL(r.blob), duration: r.duration, clippedTo: seconds, uploading: false, phase: null, progress: null });
        }, function (err) {
          patchItem('samples', x.id, { key: full.key, url: full.url, duration: full.duration, length: 'full', uploading: false, phase: null, progress: null });
          setMessage({ error: true, text: x.name + ': not cut (' + err.message + ').' });
        });
    }
    function setLength(x, value) {
      if (value === 'clip') { applyClip(x, x.clipSeconds || CLIP_DEFAULT); return; }
      if (openId === x.id) stopAudio();
      var full = x.full;
      patchItem('samples', x.id, full ? { key: full.key, url: full.url, duration: full.duration, length: 'full', clippedTo: null } : { length: 'full' });
    }
    function commitSeconds(x) {
      var n = parseInt(String(x.clipText != null ? x.clipText : '').trim(), 10);
      if (x.clipText == null || n === x.clippedTo) return;
      applyClip(x, n);
    }
    function overviewSampleItem(s) {
      var clip = s.length === 'clip';
      return fileItem('samples', Object.assign({}, s, { name: s.duration ? s.name + ' · ' + mmss(s.duration) : s.name }),
        { playing: playing === s.id, onTogglePlay: function () { togglePlay(s); } },
        h(React.Fragment, null,
          h(Z.Input, { id: 'sample-title-' + s.id, 'aria-label': 'Title of ' + s.name, value: sampleTitleOf(s),
            onChange: function (e) { patchItem('samples', s.id, { title: e.target.value }); } }),
          h('div', { className: 'admin-sample-clip' },
            h(Z.Input, { variant: 'select', id: 'sample-length-' + s.id, label: 'Length', value: clip ? 'clip' : 'full', disabled: s.uploading || locked,
              onChange: function (e) { setLength(s, e.target.value); } }, opts([['full', 'Full'], ['clip', 'Clip']])),
            clip ? h(Z.Input, { id: 'sample-seconds-' + s.id, label: 'Duration (s)', inputMode: 'numeric', disabled: s.uploading || locked,
              value: s.clipText != null ? s.clipText : String(s.clipSeconds || CLIP_DEFAULT),
              supportText: 'From the start, no fade. Enter to cut again.',
              onChange: function (e) { patchItem('samples', s.id, { clipText: e.target.value }); },
              onBlur: function () { commitSeconds(s); },
              onKeyDown: function (e) { if (e.key === 'Enter') { e.preventDefault(); commitSeconds(s); } } }) : null)));
    }
    // samples of a line keep the overview order; reorder happens in the overview
    function lineSamples(i) { return f.samples.filter(function (s) { return s.line === i + 1; }); }

    var isNew = !f.listingId;
    var locked = f.status === 'reserved' || f.status === 'sold' || f.status === 'traded' || f.status === 'archived';

    var main = h('div', { className: 'admin-main' },
      h('h1', { className: 'label-extra-large' }, isNew ? 'Create listing' : 'Edit listing'),

      h('section', { className: 'admin-section' },
        // Figma Create → `custom title` (0111): From Discogs under the field, only while Discogs match holds a release
        h('div', { className: 'admin-custom-title' },
          h(Z.Input, Object.assign({ id: 'custom-title', label: 'Custom title', optional: true,
            supportText: 'Replaces "Artist - Title" in the shop. Artist names in it link to their records.' }, bind('customTitle'))),
          discogsId(f.discogs) !== null ? h(Z.Button, { hierarchy: 'secondary', disabled: locked || titling,
            'aria-busy': titling || undefined, onClick: titleFromDiscogs }, 'From Discogs') : null),
        h(Z.Input, Object.assign({ id: 'discogs', label: 'Discogs match', optional: true, variant: 'search',
          placeholder: 'Release URL or number', supportText: errors.discogs ? undefined : 'Paste the release link, then Fetch Discogs.' }, bind('discogs'))),
        // Figma 2104:20728: secondary button right under Discogs match (gap 16)
        // Figma Create → `discogs actions` (0092): Fetch Discogs + Photo of the label; picking a release found from
        // the photo puts its link in Discogs match and fetches it
        h(PhotoField, { disabled: locked, pickHint: 'Pick the pressing to fetch it.', onFound: setPhotoFound,
          actions: h(Z.Button, { hierarchy: 'secondary', disabled: locked, 'aria-busy': fetching || undefined, onClick: function () { fetchDiscogs(); } }, 'Fetch Discogs') }),
        photoFound ? h(Z.ReleaseList, { listId: 'photo-releases', label: 'Releases on Discogs',
            message: photoFound.results.length ? undefined : 'No match on Discogs for what the photo shows. Paste the release link instead.' },
          photoFound.results.map(function (r, i) {
            function pick() { setPhotoFound(null); set({ discogs: 'https://www.discogs.com/release/' + r.id }); fetchDiscogs(r.id); }
            return h(Z.ReleaseOption, { key: r.id, id: 'photo-release-' + i, title: r.title, meta: r.meta, thumb: r.thumb, tabIndex: 0,
              onClick: pick, onKeyDown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } } });
          })) : null),
      h(Z.Divider),

      h('section', { className: 'admin-section' },
        h('div', { className: 'admin-stack' },
          f.lines.map(function (l, i) {
            var samples = lineSamples(i);
            // Figma `listing line`: removable = line 2+ (onRemove); the sample is a FileList or a DropZone (0022)
            return h(Z.ListingLine, { key: l.id,
              onRemove: i > 0 ? function () { removeLine(i); } : undefined, removeLabel: 'Remove line ' + (i + 1),
              artist: h(Z.EntityField, { id: 'artist-' + i, label: 'Artist ' + (i + 1), optional: i > 0,
                placeholder: l.artists.length ? 'Add artist' : (i > 0 ? 'Same as line 1' : 'Search or create'),
                options: entities && entities.artists, value: l.artists, error: errors['artist-' + i],
                onChange: function (chips, info) { setLineArtists(i, chips, info); } }),
              title: h(Z.Input, { id: 'title-' + i, label: 'Title ' + (i + 1),
                value: l.title, error: errors['title-' + i], onChange: function (e) { setLine(i, 'title', e.target.value); } }),
              spelling: h(Z.Checkbox, { label: 'Different spelling', checked: l.artistSpelled,
                onChange: function (e) { setLine(i, 'artistSpelled', e.target.checked); } }),
              credit: l.artistSpelled ? h(Z.Input, { id: 'artist-credit-' + i, label: 'Artist name on label',
                value: l.artistCredit, onChange: function (e) { setLine(i, 'artistCredit', e.target.value); } }) : null
            },
              // one sample per line: the drop zone goes away once the line has one (back if it is removed)
              samples.length ? h(Z.FileList, null, samples.map(sampleItem))
                : h(Z.DropZone, { label: 'Browse sample', accept: 'audio/mpeg', multiple: false, onFiles: addFiles('sample', i + 1) }));
          })),
        h('div', null, h(Z.Button, { hierarchy: 'secondary', onClick: addLine }, 'Add line'))),
      h(Z.Divider),

      h('section', { className: 'admin-section' },
        h('div', { className: 'admin-row admin-row--tight' },
          h(Z.EntityField, { className: 'span-4', id: 'label', label: 'Label', multiple: false, placeholder: 'Search or create',
            options: entities && entities.labels, value: f.label, error: errors.label, onChange: setLabel }),
          h(Z.Input, Object.assign({ className: 'span-2', id: 'country', label: 'Country', variant: 'select', placeholder: '' }, bind('country')), opts(COUNTRIES)),
          h(Z.Input, Object.assign({ className: 'span-2', id: 'year', label: 'Year', optional: true, placeholder: '1983 or 1990s', maxLength: 5 }, bind('year'))),
          // Figma 2104:21454: a pre-release ("blank") of the same label → the shop shows "Pre" next to the label
          h(Z.Checkbox, { className: 'span-4 row-start', label: 'Pre-release', checked: f.preRelease,
            onChange: function (e) { set({ preRelease: e.target.checked }); } }),
          h(Z.Checkbox, { className: 'span-4 row-start', label: 'Different spelling', checked: f.labelSpelled,
            onChange: function (e) { set({ labelSpelled: e.target.checked }); } }),
          f.labelSpelled ? h(Z.Input, Object.assign({ className: 'span-4', id: 'label-credit', label: 'Label spelled on record' }, bind('labelCredit'))) : null),
        h('div', { className: 'admin-row' },
          h(Z.Input, Object.assign({ className: 'span-2', id: 'format', label: 'Format', variant: 'select', placeholder: '' }, bind('format')), opts(FORMATS)),
          h(Z.Input, Object.assign({ className: 'span-2', id: 'section', label: 'Sale type', variant: 'select' }, bind('section')), opts([['sale', 'For sale']].concat(tradeOn !== false || f.section === 'trade' ? [['trade', 'For trade']] : []))),
          h(Z.Input, Object.assign({ className: 'span-2', id: 'price', label: 'Price', suffix: '€', inputMode: 'decimal', optional: f.section === 'trade' }, bind('price'))))),
      h(Z.Divider),

      h('section', { className: 'admin-section' },
        // Figma 2126:1404: Macro genre + Genres (Discogs styles, 0048), then the shop's own Tags on their own row
        h('div', { className: 'admin-row' },
          h(Z.Input, Object.assign({ className: 'span-4', id: 'macro-genre', label: 'Macro genre', variant: 'select', placeholder: '' }, bind('macroGenre')), opts(MACRO_GENRES)),
          h(Z.EntityField, { className: 'span-4', id: 'genres', label: 'Genres', optional: true, placeholder: 'Add genre',
            options: entities && entities.genres, value: f.genres, onChange: function (chips) { set({ genres: chips }); } })),
        h('div', { className: 'admin-row' },
          h(Z.EntityField, { className: 'span-4', id: 'tags', label: 'Tags', optional: true, placeholder: 'Add tag',
            options: entities && entities.tags, value: f.tags, onChange: function (chips) { set({ tags: chips }); } }))),
      h(Z.Divider),

      h('section', { className: 'admin-section' },
        // Figma 2095:20560: media graded per side (side B optional, migration 0013), comment on its own row
        h('div', { className: 'admin-row' },
          h(Z.Input, Object.assign({ className: 'span-4', id: 'condition', label: 'Side A conditions', variant: 'select', placeholder: '' }, bind('condition')), opts(GRADES)),
          h(Z.Input, Object.assign({ className: 'span-4', id: 'condition-b', label: 'Side B conditions', optional: true, variant: 'select', placeholder: '' }, bind('conditionB')), opts(GRADES))),
        h('div', { className: 'admin-row' },
          h(Z.Input, Object.assign({ className: 'span-8', id: 'condition-notes', label: 'Conditions comment', optional: true }, bind('conditionNotes')))),
        h('div', { className: 'admin-row' },
          h(Z.Input, Object.assign({ className: 'span-4', id: 'sleeve-type', label: 'Cover', variant: 'select' }, bind('sleeveType')), opts(SLEEVES)),
          f.sleeveType !== 'none' ? h(Z.Input, Object.assign({ className: 'span-4', id: 'sleeve-condition', label: 'Cover conditions', optional: true, variant: 'select', placeholder: '' }, bind('sleeveCondition')), opts(GRADES)) : null)),
      h(Z.Divider),

      h('section', { className: 'admin-section' },
        h(Z.Input, Object.assign({ id: 'notes', label: 'Description / comment', optional: true }, bind('notes')))),
      h(Z.Divider),

      h('section', { className: 'admin-section' },
        h('h2', { className: 'label-medium' }, 'Images'),
        f.images.length ? h(Z.FileList, { onMove: moveIn('images') }, f.images.map(function (x, i) {
          return fileItem('images', x, { image: { src: x.url }, featured: i === 0 });
        })) : null,
        h(Z.DropZone, { label: 'Browse image', accept: 'image/jpeg,image/png,image/webp', multiple: true, onFiles: addFiles('photo') })),
      h(Z.Divider),

      h('section', { className: 'admin-section' },
        h('h2', { className: 'label-medium' }, 'Samples overview'),
        f.samples.length ? h(Z.FileList, { className: 'admin-samples', onMove: moveIn('samples') }, f.samples.map(overviewSampleItem)) : null,
        h(Z.DropZone, { label: 'Browse sample', accept: 'audio/mpeg', multiple: true, onFiles: addFiles('sample', null) })));

    var shopUrl = f.slug && f.status !== 'draft' && f.status !== 'archived' && CFG.storefrontUrl ? CFG.storefrontUrl.replace(/\/$/, '') + '/products/' + f.slug + '/' : null;
    var publishBtn = h(Z.Button, { key: 'publish', hierarchy: 'primary', disabled: saving || locked, onClick: function () { save('available'); } }, f.status === 'available' ? 'Update' : 'Publish now');
    var draftBtn = h(Z.Button, { key: 'draft', hierarchy: 'secondary', disabled: saving || locked || f.status === 'available', onClick: function () { save('draft'); } }, 'Save draft');
    var shopBtn = shopUrl ? h(Z.Button, { key: 'shop', hierarchy: 'secondary', href: shopUrl, target: '_blank', rel: 'noopener' }, 'View in store') : null;
    var statusLine = h('p', { className: 'admin-status body-small' + (message && message.error ? ' admin-status--error' : ''), role: 'status' }, message ? message.text : '');
    // mobile (decision 0089): Publish / Save draft in the ActionBar at the bottom of the viewport, with the save result
    // above them; View in store stays in the side content, which follows the form
    var side = h('aside', { className: 'admin-side' },
      mobile ? shopBtn : h(Z.ActionPanel, null, publishBtn, draftBtn, shopBtn),
      mobile ? null : statusLine,
      h(Z.Input, { id: 'sku', label: 'Sku', readOnly: true, value: f.sku ? String(f.sku) : '', placeholder: 'On first save', supportText: 'Automatic-generated' }),
      shopPreview(),
      locked ? h('p', { className: 'body-small' }, 'This copy is ' + f.status + ': it can no longer be edited here.') : null,
      isNew ? null : statusPanel());

    /* Figma BACKEND → Create › side › preview (2133:933, Gio 2026-11-10, decision 0030): the PDP - mobile content
       (gallery + product info, no header, no Add to bag) in the shop theme, filled in while the form is typed.
       Same components as the shop; empty parts are left out. Its sample buttons play through the admin audio. */
    function shopPreview() {
      var title = previewName(f), tags = previewTags(f);
      var previewCover = f.sleeveType !== 'none' && f.sleeveCondition ? 'Cover: ' + f.sleeveCondition : null;
      var previewNote = f.conditionNotes.trim() ? '(' + f.conditionNotes.trim() + ')' : null;
      var images = f.images.slice(0, 2).map(function (x, i) { return { src: x.url, alt: i === 0 ? title : '' }; });
      return h('section', { className: 'admin-section admin-preview', 'aria-labelledby': 'admin-preview-title' },
        h('h2', { id: 'admin-preview-title', className: 'label-medium' }, 'Preview'),
        h('div', { className: 'admin-preview__shop', 'data-theme': 'frontend' },
          images.length ? h(Z.Gallery, { device: 'mobile', images: images }) : null,
          h(Z.ProductInfo, {
            device: 'mobile', headingLevel: 3,
            title: title,
            price: previewPrice(f),
            releaseInfo: previewReleaseInfo(f) || null,
            tags: tags.length ? h(Z.TagGroup, null, tags.map(function (n, i) { return h(Z.Tag, { key: i, size: 'large' }, n); })) : null,
            description: f.notes.trim() || null,
            // same lines as the shop (gradingProps in apps/storefront/pages/shell.js, decision 0042)
            grading: f.condition ? 'Record: ' + [f.condition, f.conditionB].filter(Boolean).join(' / ') + (previewNote && !previewCover ? ' ' + previewNote : '') : null,
            cover: previewCover,
            conditions: previewCover ? previewNote : null,
            samples: f.samples.length ? f.samples.map(function (s, i) {
              var t = sampleTitleOf(s);
              return h(Z.PlayerButton, { key: s.id, playing: playing === s.id, onClick: function () { togglePlay(s); },
                'aria-label': t ? undefined : (title || 'Listing') + ', sample ' + (i + 1) }, t || null);
            }) : null
          })));
    }

    function again() {
      if (saving) return;
      setSaving(true); setMessage(null);
      sellAgain(f.listingId).then(function (twin) {
        setSaving(false);
        location.hash = '#edit-' + twin.id;
        toast('New listing, SKU ' + twin.sku + ': a draft of the same record. Check condition, price and photos, then publish.');
      }, function (err) { setSaving(false); setMessage({ error: true, text: 'Not created: ' + err.message }); });
    }
    function statusPanel() {
      var closing = f.section === 'sale' ? 'sold' : 'traded';
      var actions = {
        draft: [],
        available: [[closing, f.section === 'sale' ? 'Mark as sold' : 'Mark as traded'], ['reserved', 'Reserve'], ['draft', 'Unpublish']],
        reserved: [[closing, f.section === 'sale' ? 'Mark as sold' : 'Mark as traded'], ['available', 'Release']],
        sold: [['available', 'Make available again']],
        traded: [['available', 'Make available again']],
        archived: [['restore', 'Restore']]
      }[f.status] || [];
      var support = f.checkoutUntil ? 'Checkout in progress until ' + f.checkoutUntil.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '.'
        : f.soldAt && (f.status === 'sold' || f.status === 'traded') ? 'Since ' + new Date(f.soldAt).toLocaleDateString() + '.' : undefined;
      return h('section', { className: 'admin-section' },
        h(Z.Input, { id: 'status', label: 'Status', readOnly: true, value: STATUS_LABEL[f.status] || f.status, supportText: support }),
        actions.length ? h(Z.Input, { id: 'status-note', label: 'Status note', optional: true, value: statusNote,
          supportText: 'Kept in the history, e.g. "sold at the fair".', onChange: function (e) { setStatusNote(e.target.value); } }) : null,
        actions.map(function (a) {
          return h(Z.Button, { key: a[0], hierarchy: 'secondary', disabled: saving || !!f.checkoutUntil, onClick: function () { a[0] === 'restore' ? restore() : setStatus(a[0]); } }, a[1]);
        }),
        // decision 0100: a twin of a sold copy (new SKU, same record), as a draft
        f.status === 'sold' || f.status === 'traded' ? h(Z.Button, { key: 'again', hierarchy: 'secondary', disabled: saving, onClick: again }, 'Sell again') : null,
        f.status === 'sold' || f.status === 'traded' ? h('p', { className: 'body-small' }, 'Sell again: a new draft listing of the same record (new SKU, same details, photos and samples). This one stays ' + f.status + '.') : null);
    }

    // the Player as in the shop: cover, sample title, "Artist - Title", previous / next through the samples
    var queue = playable(), cur = openId ? f.samples.filter(function (x) { return x.id === openId; })[0] : null;
    var at = cur ? queue.indexOf(cur) : -1, cover = f.images[0];
    var player = h('div', { className: 'admin-player', ref: playerRef, 'data-open': cur ? '' : undefined, 'aria-hidden': cur ? undefined : 'true' },
      h(Z.Player, {
        image: cover && cover.url ? { src: cover.url } : undefined,
        sampleTitle: cur ? sampleTitleOf(cur) || cur.name : '',
        productName: previewName(f) || 'Untitled',
        index: Math.max(at + 1, 1), total: queue.length, playing: !!cur && playing === cur.id, audioRef: audioRef,
        onPrevious: function () { togglePlay(queue[at - 1]); },
        onNext: function () { togglePlay(queue[at + 1]); },
        onTogglePlay: function () { if (cur) togglePlay(cur); },
        onClose: closePlayer
      }));

    return h('div', { className: 'admin-page admin-page--edit' }, main, side,
      mobile ? h(Z.ActionBar, { status: statusLine }, publishBtn, draftBtn) : null, player);
  }

  // ── Listings ──────────────────────────────────────────────────────────────
  function nameOf(row) {
    if (row.custom_title) return row.custom_title;
    var lines = ((row.release || {}).lines || []).slice().sort(function (a, b) { return a.position - b.position; });
    if (!lines.length) return row.slug;
    var multi = lines.some(function (l, i) { return i > 0 && l.artist; });
    function join(a, t) { return a ? a + ' - ' + t : t; }   // a bulk draft may have no artist yet (0107)
    return multi ? lines.map(function (l) { return join(l.artist || lines[0].artist, l.title); }).join(' / ')
                 : join(lines[0].artist, lines.map(function (l) { return l.title; }).join(' / '));
  }
  /* a draft that cannot be published yet (bulk create, decision 0107): what the shop needs and the draft lacks.
     The database checks the same on publish (trigger listings_publish_check, migration 0026). */
  function missingOf(row) {
    var r = row.release || {}, line1 = (r.lines || []).filter(function (l) { return l.position === 1; })[0];
    var m = [];
    if (!line1 || !line1.artist) m.push('artist');
    if (!r.format) m.push('format');
    if (!row.condition_media) m.push('grading');
    if (row.section === 'sale' && (row.price_cents === null || row.price_cents === undefined)) m.push('price');
    return m;
  }
  function incomplete(row) { return effectiveStatus(row) === 'draft' && missingOf(row).length > 0; }
  function statusText(row) { var s = STATUS_LABEL[effectiveStatus(row)] || row.status; return incomplete(row) ? s + ' · Incomplete' : s; }
  /* Figma BACKEND → Listings (2026-11-10, decisions 0024, 0025): status tabs, a bulk bar that is always there (fixed
     height: no layout shift), a table whose first column selects. Every action asks first in a Dialog; Publish /
     Unpublish / Archive then offer Undo. Each action moves only the rows it is allowed for. */
  var TABS = [
    ['all', 'All', function (s) { return s !== 'archived'; }],
    ['draft', 'Drafts', function (s) { return s === 'draft'; }],
    ['live', 'Live', function (s) { return s === 'available' || s === 'reserved'; }],
    ['sold', 'Sold', function (s) { return s === 'sold' || s === 'traded'; }],
    ['archived', 'Archived', function (s) { return s === 'archived'; }]
  ];
  var BULK = [['publish', 'Publish'], ['unpublish', 'Unpublish'], ['archive', 'Archive'], ['delete', 'Delete']];
  var UNDO = { publish: 'unpublish', unpublish: 'publish', archive: 'restore' };
  var DONE_VERB = { publish: 'published', unpublish: 'unpublished', archive: 'archived', restore: 'restored', delete: 'deleted' };
  var purgeAsked = false;
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  // a live Stripe checkout holds the copy (reserved with an expiry; a manual hold has none)
  function inCheckout(r) { return r.eff === 'reserved' && !!r.reserved_until; }
  function ordered(r) { return !!(r.orders && r.orders[0] && r.orders[0].count); }
  /* Gio 2026-11-10 (decision 0025): every bulk action asks first. Which selected rows it applies to (the database
     applies the same rules) and what the dialog says about them. */
  var ACTION = {
    publish:   { ok: function (r) { return r.eff === 'draft' && !incomplete(r); },
                 one: 'goes live in the shop in about 2 minutes.', many: 'go live in the shop in about 2 minutes.' },
    unpublish: { ok: function (r) { return r.eff === 'available'; },
                 one: 'leaves the shop and goes back to drafts.', many: 'leave the shop and go back to drafts.' },
    archive:   { ok: function (r) { return r.eff !== 'archived' && !inCheckout(r); },
                 one: 'leaves the shop: you find it under Archived and can restore it.', many: 'leave the shop: you find them under Archived and can restore them.' },
    delete:    { ok: function (r) { return !ordered(r) && !inCheckout(r); },
                 one: 'is removed with its photos and samples, and its page leaves the shop. This cannot be undone.',
                 many: 'are removed with their photos and samples, and their pages leave the shop. This cannot be undone.' }
  };

  function Listings() {
    var mobile = useIsMobile();
    var st = useState(null), rows = st[0], setRows = st[1];
    var er = useState(null), error = er[0], setError = er[1];
    var tb = useState('all'), tab = tb[0], setTab = tb[1];
    var se = useState([]), selected = se[0], setSelected = se[1];
    var ms = useState(null), message = ms[0], setMessage = ms[1];
    var bs = useState(false), busy = bs[0], setBusy = bs[1];
    var cf = useState(null), confirm = cf[0], setConfirm = cf[1];
    var focusAfter = useRef(null);

    function load() {
      return sb.from('listings').select('id,sku,slug,status,reserved_until,published_at,section,price_cents,condition_media,custom_title,created_at,orders:order_items(count),release:releases(format,lines:release_lines(position,artist,title))')
        .order('created_at', { ascending: false })
        .then(function (res) { if (res.error) setError(res.error.message); else setRows(res.data); });
    }
    useEffect(function () {
      load();
      // files of deleted copies leave R2 after 7 days (Edge Function purge-media, 0009); once per visit, best effort
      if (!purgeAsked) { purgeAsked = true; sb.functions.invoke('purge-media').catch(function () {}); }
    }, []);
    // after a delete, focus the row that took the place of the first deleted one (never lost to <body>)
    useEffect(function () {
      if (!focusAfter.current || !rows) return;
      var el = document.getElementById(focusAfter.current.id) || document.getElementById('select-all');
      focusAfter.current = null;
      if (el) el.focus();
    }, [rows]);

    if (error) return h('p', { className: 'body-medium admin-status--error', role: 'alert' }, 'Could not load the listings: ' + error);
    if (!rows) return h('p', { className: 'body-medium' }, 'Loading…');

    var withStatus = rows.map(function (r) { return Object.assign({ eff: effectiveStatus(r) }, r); });
    var current = TABS.filter(function (t) { return t[0] === tab; })[0];
    var visible = withStatus.filter(function (r) { return current[2](r.eff); });
    var picked = visible.filter(function (r) { return selected.indexOf(r.id) >= 0; });
    var allOn = visible.length > 0 && picked.length === visible.length;
    var someOn = picked.length > 0 && !allOn;
    var byId = {}; withStatus.forEach(function (r) { byId[r.id] = r; });

    function toggle(id, on) {
      setSelected(function (cur) { return on ? cur.concat([id]) : cur.filter(function (x) { return x !== id; }); });
    }
    function toggleAll() { setSelected(allOn ? [] : visible.map(function (r) { return r.id; })); }
    function pickTab(v) { setTab(v); setSelected([]); }
    function summary(n, action, skipped) {
      var text = plural(n, 'listing') + ' ' + DONE_VERB[action] + '.';
      if (n === 1) text = '“' + nameOf(byId[arguments[3]] || {}) + '” ' + DONE_VERB[action] + '.';
      if (skipped.length) {
        var why = {};
        skipped.forEach(function (x) { var k = STATUS_LABEL[x.status] ? STATUS_LABEL[x.status].toLowerCase() : 'not found'; why[k] = (why[k] || 0) + 1; });
        text += ' ' + skipped.length + ' skipped (' + Object.keys(why).map(function (k) { return why[k] + ' ' + k; }).join(', ') + ').';
      }
      return text;
    }
    async function run(action, ids, isUndo) {
      setBusy(true);
      var res = await sb.rpc('admin_bulk_status', { p_ids: ids, p_action: action });
      setBusy(false);
      if (res.error) { setMessage({ error: true, text: 'Nothing changed: ' + res.error.message }); return; }
      var done = res.data.done, skipped = res.data.skipped;
      setSelected([]);
      await load();
      var text = done.length ? summary(done.length, action, skipped, done[0].id)
                             : 'Nothing ' + DONE_VERB[action] + ': ' + plural(skipped.length, 'listing') + ' cannot be ' + DONE_VERB[action] + ' from ' + (skipped.length === 1 ? 'its' : 'their') + ' status.';
      if (done.length && done.some(function (d) { return d.from !== 'draft' || d.to !== 'draft'; })) text += ' The shop updates in about 2 minutes.';
      if (!done.length) { setMessage({ error: true, text: text }); return; }   // nothing happened: inline, like errors
      // done: the rows left this tab, so the result and its Undo are a toast (decision 0049)
      setMessage(null);
      var undo = isUndo ? null : { action: UNDO[action], ids: done.map(function (d) { return d.id; }) };
      toast(isUndo ? 'Undone: ' + text : text, undo ? function () { run(undo.action, undo.ids, true); } : null);
    }
    function ask(action) {
      var ok = picked.filter(ACTION[action].ok), rest = picked.filter(function (r) { return !ACTION[action].ok(r); });
      if (!ok.length) {
        var gaps = action === 'publish' && picked.some(incomplete);
        setMessage({ error: true, text: 'None of the selected listings can be ' + DONE_VERB[action] + (gaps
          ? ': incomplete drafts need ' + missingOf(picked.filter(incomplete)[0]).join(', ') + ' first (open the draft).'
          : ' from ' + (picked.length === 1 ? 'its' : 'their') + ' status.') });
        setSelected([]);
        return;
      }
      setConfirm({ action: action, ok: ok, rest: rest });
    }
    async function doDelete(ok) {
      var ids = ok.map(function (r) { return r.id; });
      setBusy(true);
      var res = await sb.rpc('admin_delete_listings', { p_ids: ids });
      setBusy(false);
      setConfirm(null);
      if (res.error) { setMessage({ error: true, text: 'Nothing deleted: ' + res.error.message }); return; }
      var gone = res.data.deleted, kept = res.data.skipped.length;
      var firstIdx = visible.findIndex(function (r) { return gone.indexOf(r.id) >= 0; });
      var next = visible.slice(firstIdx + 1).filter(function (r) { return gone.indexOf(r.id) < 0; })[0];
      focusAfter.current = { id: next ? 'select-' + next.id : 'select-all' };
      setSelected([]);
      await load();
      var text = gone.length === 1 ? '“' + nameOf(ok.filter(function (r) { return r.id === gone[0]; })[0] || {}) + '” deleted.' : plural(gone.length, 'listing') + ' deleted.';
      if (kept) text += ' ' + plural(kept, 'listing') + ' kept (an order or a checkout holds ' + (kept === 1 ? 'it' : 'them') + ').';
      setMessage(null);
      toast(text);   // the rows are gone: a toast, no Undo (delete is final, 0025)
    }
    function confirmed() {
      var c = confirm;
      if (c.action === 'delete') { doDelete(c.ok); return; }
      setConfirm(null);
      run(c.action, c.ok.map(function (r) { return r.id; }));
    }

    var counts = {}; TABS.forEach(function (t) { counts[t[0]] = withStatus.filter(function (r) { return t[2](r.eff); }).length; });
    var bar = h('div', { className: 'admin-bulk' },
      h('p', { className: 'admin-bulk__count body-medium', 'aria-live': 'polite' }, picked.length + ' selected'),
      picked.length
        ? h('div', { className: 'admin-bulk__actions' },
            BULK.map(function (b) {
              return h(Z.Button, { key: b[0], hierarchy: 'secondary', 'aria-busy': busy || undefined,
                onClick: busy ? undefined : function () { ask(b[0]); } }, b[1]);
            }))
        : null,
      h('div', { className: 'admin-bulk__message', role: 'status', hidden: !!picked.length },
        message ? h('span', { className: 'body-medium' + (message.error ? ' admin-status--error' : '') }, message.text) : null,
        null));

    var dialog = null;
    if (confirm) {
      var n = confirm.ok.length, verb = BULK.filter(function (x) { return x[0] === confirm.action; })[0][1];
      var names = confirm.ok.slice(0, 5).map(function (r) { return '“' + nameOf(r) + '”'; });
      var list = n > 5 ? names.join(', ') + ' and ' + (n - 5) + ' more'
               : names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
      var what = n === 1 ? ACTION[confirm.action].one : ACTION[confirm.action].many;
      var rest = confirm.rest.length;
      var restText = !rest ? '' : ' ' + plural(rest, 'other selected listing') + ' cannot be ' + DONE_VERB[confirm.action] +
        (confirm.action === 'delete' ? ' (an order or a checkout holds ' + (rest === 1 ? 'it' : 'them') + ')'
          : confirm.action === 'publish' && confirm.rest.some(incomplete) ? ' (incomplete drafts, or not drafts)'
          : ' from ' + (rest === 1 ? 'its' : 'their') + ' status') + ' and stays as it is.';
      if (rest > 1) restText = restText.replace(' stays as it is.', ' stay as they are.');
      dialog = h(Z.Dialog, { open: true, busy: busy,
        title: verb + ' ' + plural(n, 'listing') + '?', confirmLabel: verb + ' ' + plural(n, 'listing'),
        onCancel: function () { setConfirm(null); }, onConfirm: confirmed },
        h('p', null, list + ' ' + what + restText));
    } else dialog = h(Z.Dialog, { open: false, title: '', confirmLabel: '', onCancel: function () {}, onConfirm: function () {} }, '');

    return h('div', { className: 'admin-section admin-listings' },
      h('h1', { className: 'label-extra-large' }, 'Listings'),
      h(Z.Tabs, { value: tab, onValueChange: pickTab, 'aria-label': 'Filter by status' },
        TABS.map(function (t) { return h(Z.Tab, { key: t[0], value: t[0], suffix: String(counts[t[0]]), 'aria-controls': 'listings-table' }, t[1]); })),
      // mobile (Figma page `admin` → Listings - mobile, decision 0089): rows instead of the table, the bulk bar after them
      // (sticky at the bottom while something is selected)
      mobile ? h('ul', { id: 'listings-table', className: 'admin-rows' }, visible.length ? visible.map(function (r) {
        return h(Z.ListingRow, { key: r.id, href: '#edit-' + r.id, title: nameOf(r),
          meta: [r.sku, statusText(r), r.section].filter(Boolean).join(' · '),
          price: r.price_cents === null ? null : centsToText(r.price_cents) + ' €',
          select: h(Z.Checkbox, { id: 'select-' + r.id, hideLabel: true, label: 'Select ' + nameOf(r),
            checked: selected.indexOf(r.id) >= 0, onChange: function (e) { toggle(r.id, e.target.checked); } }) });
      }) : h('li', { className: 'body-small admin-rows__empty' }, 'No listings here.')) : bar,
      mobile ? bar : h('div', { className: 'admin-table-wrap' },
        h('table', { id: 'listings-table', className: 'admin-table body-small' },
          h('thead', null, h('tr', null,
            h('th', { className: 'select' }, visible.length ? h(Z.Checkbox, { id: 'select-all', hideLabel: true, label: 'Select all', checked: allOn, indeterminate: someOn, onChange: toggleAll }) : null),
            ['SKU', 'Record', 'Status', 'Section', 'Price'].map(function (t) { return h('th', { key: t, className: t === 'SKU' ? 'num' : t === 'Price' ? 'num price' : '' }, t); }))),
          h('tbody', null, visible.length ? visible.map(function (r) {
            return h('tr', { key: r.id },
              h('td', { className: 'select' }, h(Z.Checkbox, { id: 'select-' + r.id, hideLabel: true, label: 'Select ' + nameOf(r),
                checked: selected.indexOf(r.id) >= 0, onChange: function (e) { toggle(r.id, e.target.checked); } })),
              h('td', { className: 'num' }, r.sku),
              h('td', null, h('a', { href: '#edit-' + r.id }, nameOf(r))),
              h('td', null, statusText(r)),
              h('td', null, r.section),
              h('td', { className: 'num price' }, r.price_cents === null ? '' : centsToText(r.price_cents) + ' €'));
          }) : h('tr', null, h('td', { colSpan: 6 }, 'No listings here.'))))),
      dialog);
  }

  function EditLoader(props) {
    var st = useState(null), initial = st[0], setInitial = st[1];
    var er = useState(null), error = er[0], setError = er[1];
    useEffect(function () {
      sb.from('listings').select('*,release:releases(*,label_entity:labels(id,name),genre_rows:release_genres(position,genre:genres(id,name)),tag_rows:release_tags(position,tag:tags(id,name)),lines:release_lines(*,credits:release_line_artists(position,artist:artists(id,name))),samples(*))').eq('id', props.id).single()
        .then(function (res) { if (res.error) setError(res.error.message); else setInitial(formFromRow(res.data)); });
    }, [props.id]);
    if (error) return h('p', { className: 'body-medium admin-status--error', role: 'alert' }, 'Could not open this listing: ' + error);
    if (!initial) return h('p', { className: 'body-medium' }, 'Loading…');
    return h(ListingForm, { initial: initial });
  }

  // ── Orders ────────────────────────────────────────────────────────────────
  /* Figma BACKEND → Orders (2322:5367, decision 0100): orders are written by Stripe (stripe-webhook, migration 0021);
     the admin reads them and moves paid → shipped with the tracking number (RLS orders_admin / orders_admin_update).
     Tabs To ship · Shipped · All, newest first. "Check" = orders.attention (a copy not held any more: refund by hand).
     Routes: #orders · #orders/<id> */
  var ORDER_TABS = [
    ['toship', 'To ship', function (o) { return o.status === 'paid'; }],
    ['shipped', 'Shipped', function (o) { return o.status === 'shipped'; }],
    ['all', 'All', function () { return true; }]
  ];
  var ORDER_STATUS = { paid: 'To ship', shipped: 'Shipped', refunded: 'Refunded', cancelled: 'Cancelled' };
  function orderRef(o) { return String(o.id).slice(0, 8).toUpperCase(); }
  function orderStatus(o) { return o.attention && o.status === 'paid' ? 'Check' : ORDER_STATUS[o.status] || o.status; }
  function euro(c) { return c === null || c === undefined ? '' : centsToText(c) + ' €'; }   // as the Listings prices
  function shortDate(t) { return new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' }); }
  function buyerOf(o) { return o.customer_name || (o.shipping_address && o.shipping_address.name) || o.email; }

  function Orders() {
    var mobile = useIsMobile();
    var st = useState(null), rows = st[0], setRows = st[1];
    var er = useState(null), error = er[0], setError = er[1];
    var tb = useState('toship'), tab = tb[0], setTab = tb[1];
    useEffect(function () {
      sb.from('orders').select('id,created_at,email,customer_name,shipping_address,total_cents,status,attention')
        .order('created_at', { ascending: false })
        .then(function (res) { if (res.error) setError(res.error.message); else setRows(res.data); });
    }, []);
    if (error) return h('p', { className: 'body-medium admin-status--error', role: 'alert' }, 'Could not load the orders: ' + error);
    if (!rows) return h('p', { className: 'body-medium' }, 'Loading…');
    var counts = {}; ORDER_TABS.forEach(function (t) { counts[t[0]] = rows.filter(t[2]).length; });
    var filter = ORDER_TABS.filter(function (t) { return t[0] === tab; })[0][2];
    var visible = rows.filter(filter);
    var empty = rows.length ? 'No orders here.' : 'No orders yet. They arrive here when someone pays on Stripe.';
    return h('div', { className: 'admin-section admin-listings' },
      h('h1', { className: 'label-extra-large' }, 'Orders'),
      h(Z.Tabs, { value: tab, onValueChange: setTab, 'aria-label': 'Filter by status' },
        ORDER_TABS.map(function (t) { return h(Z.Tab, { key: t[0], value: t[0], suffix: String(counts[t[0]]), 'aria-controls': 'orders-table' }, t[1]); })),
      mobile ? h('ul', { id: 'orders-table', className: 'admin-rows' }, visible.length ? visible.map(function (o) {
        return h(Z.ListingRow, { key: o.id, href: '#orders/' + o.id, title: buyerOf(o),
          meta: [orderRef(o), shortDate(o.created_at), orderStatus(o)].join(' · '), price: euro(o.total_cents) });
      }) : h('li', { className: 'body-small admin-rows__empty' }, empty))
      : h('div', { className: 'admin-table-wrap' },
          h('table', { id: 'orders-table', className: 'admin-table body-small' },
            h('thead', null, h('tr', null,
              ['Order', 'Buyer', 'Status', 'Date', 'Total'].map(function (t) { return h('th', { key: t, className: t === 'Order' ? 'num' : t === 'Total' ? 'num price' : '' }, t); }))),
            h('tbody', null, visible.length ? visible.map(function (o) {
              return h('tr', { key: o.id },
                h('td', { className: 'num' }, orderRef(o)),
                h('td', null, h('a', { href: '#orders/' + o.id }, buyerOf(o))),
                h('td', null, orderStatus(o)),
                h('td', null, shortDate(o.created_at)),
                h('td', { className: 'num price' }, euro(o.total_cents)));
            }) : h('tr', null, h('td', { colSpan: 5 }, empty))))));
  }

  function OrderDetail(props) {
    var mobile = useIsMobile();
    var st = useState(null), o = st[0], setO = st[1];
    var er = useState(null), error = er[0], setError = er[1];
    var tr = useState(''), tracking = tr[0], setTracking = tr[1];
    var sv = useState(false), saving = sv[0], setSaving = sv[1];
    var ms = useState(null), message = ms[0], setMessage = ms[1];
    useEffect(function () {
      sb.from('orders').select('*,items:order_items(price_cents,listing:listings(id,sku,slug,status,custom_title,release:releases(format,lines:release_lines(position,artist,title))))')
        .eq('id', props.id).single()
        .then(function (res) { if (res.error) setError(res.error.message); else { setO(res.data); setTracking(res.data.tracking_number || ''); } });
    }, [props.id]);
    if (error) return h('p', { className: 'body-medium admin-status--error', role: 'alert' }, 'Could not open this order: ' + error);
    if (!o) return h('p', { className: 'body-medium' }, 'Loading…');

    var ref = orderRef(o), a = o.shipping_address || {};
    var address = [a.name || o.customer_name, a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(' '), a.state, a.country].filter(Boolean).join('\n');
    var records = (o.subtotal_cents === null || o.subtotal_cents === undefined) ? o.total_cents - o.shipping_cents : o.subtotal_cents;
    var test = /^cs_test_/.test(o.stripe_session_id);
    var stripeUrl = o.payment_intent ? 'https://dashboard.stripe.com/' + (test ? 'test/' : '') + 'payments/' + o.payment_intent : null;
    var when = new Date(o.created_at).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    async function setShipped(shipped) {
      if (saving) return;
      setSaving(true); setMessage(null);
      var patch = shipped ? { status: 'shipped', tracking_number: tracking.trim() || null } : { status: 'paid' };
      var res = await sb.from('orders').update(patch).eq('id', o.id).select().single();
      setSaving(false);
      if (res.error) { setMessage({ error: true, text: 'Not saved: ' + res.error.message }); return; }
      setO(Object.assign({}, o, res.data));
      setMessage({ error: false, text: shipped ? 'Marked as shipped.' : 'Back to To ship.' });
    }
    async function saveTracking() {
      if (saving) return;
      setSaving(true); setMessage(null);
      var res = await sb.from('orders').update({ tracking_number: tracking.trim() || null }).eq('id', o.id).select().single();
      setSaving(false);
      if (res.error) { setMessage({ error: true, text: 'Not saved: ' + res.error.message }); return; }
      setO(Object.assign({}, o, res.data)); setMessage({ error: false, text: 'Tracking number saved.' });
    }
    function copyAddress() {
      (navigator.clipboard ? navigator.clipboard.writeText(address) : Promise.reject())
        .then(function () { toast('Address copied.'); }, function () { setMessage({ error: true, text: 'Could not copy: select the address and copy it.' }); });
    }

    var shipped = o.status === 'shipped', open = o.status === 'paid';
    var primary = shipped
      ? h(Z.Button, { key: 'ship', hierarchy: 'primary', 'aria-busy': saving || undefined, onClick: saveTracking }, 'Save tracking')
      : h(Z.Button, { key: 'ship', hierarchy: 'primary', disabled: !open, 'aria-busy': saving || undefined, onClick: function () { setShipped(true); } }, 'Mark as shipped');
    var secondary = stripeUrl ? h(Z.Button, { key: 'stripe', hierarchy: 'secondary', href: stripeUrl, target: '_blank', rel: 'noopener' }, 'Open in Stripe') : null;
    var undo = shipped ? h(Z.Button, { key: 'undo', hierarchy: 'secondary', 'aria-busy': saving || undefined, onClick: function () { setShipped(false); } }, 'Mark as not shipped') : null;
    var statusLine = h('p', { className: 'admin-status body-small' + (message && message.error ? ' admin-status--error' : ''), role: 'status' }, message ? message.text : '');

    var main = h('div', { className: 'admin-main' },
      h('h1', { className: 'label-extra-large' }, 'Order ' + ref),
      h('p', { className: 'body-small' }, [when, 'Paid', orderStatus(o)].filter(function (x, i, all) { return all.indexOf(x) === i; }).join(' · ')),
      o.attention ? h(Z.Alert, null, o.attention) : null,
      h('section', { className: 'admin-order__records', 'aria-labelledby': 'order-records' },
        h('h2', { id: 'order-records', className: 'label-medium' }, 'Records'),
        h('ul', { className: 'admin-rows' }, (o.items || []).map(function (it) {
          var l = it.listing || {};
          return h(Z.ListingRow, { key: l.id, href: '#edit-' + l.id, title: nameOf(l),
            meta: [l.sku, l.release && l.release.format, STATUS_LABEL[l.status] || l.status].filter(Boolean).join(' · '),
            price: euro(it.price_cents) });
        }))),
      h('div', { className: 'admin-order__details' },
        h(Z.OrderBlock, { title: 'Ship to', action: h(Z.Button, { hierarchy: 'secondary', onClick: copyAddress }, 'Copy address') }, address),
        h(Z.OrderBlock, { title: 'Total' }, ['Records: ' + euro(records), 'Shipping: ' + euro(o.shipping_cents), 'Total paid: ' + euro(o.total_cents)].join('\n')),
        h(Z.OrderBlock, { title: 'Buyer', action: h(Z.Button, { hierarchy: 'secondary', href: 'mailto:' + o.email + '?subject=' + encodeURIComponent('Your order ' + ref) }, 'Write to buyer') }, o.email),
        h(Z.OrderBlock, { title: 'Payment' }, ['Stripe' + (test ? ' test mode' : ''), o.status === 'refunded' ? 'Refunded' : null].filter(Boolean).join('\n'))));

    var trackingField = h(Z.Input, { id: 'tracking', label: 'Tracking number', optional: true, value: tracking,
      supportText: 'Saved with the order.', onChange: function (e) { setTracking(e.target.value); } });
    var side = h('aside', { className: 'admin-side' },
      trackingField,
      mobile ? null : h(Z.ActionPanel, null, primary, undo, secondary),
      mobile ? null : statusLine);
    return h('div', { className: 'admin-page admin-page--edit' }, main, side,
      mobile ? h(Z.ActionBar, { status: statusLine }, primary, undo || secondary) : null);
  }

  // ── Sell again ────────────────────────────────────────────────────────────
  /* Figma BACKEND → Create › "Edit listing · sold · side" (decision 0100, Gio 2026-11-15): a sold copy can be put on
     sale again as a twin: a NEW listing (new SKU from the trigger of 0020, its own slug) of the same release (same
     pressing: lines, samples, label), with the sold copy's price, conditions, notes and photos, as a draft. The sold
     listing stays sold (its order keeps pointing at it). Then the form opens on the twin to adjust and publish. */
  async function sellAgain(id) {
    var src = await sb.from('listings').select('*').eq('id', id).single();
    if (src.error) throw new Error(src.error.message);
    var l = src.data, base = (l.slug || 'record').replace(/-\d+$/, '');
    var taken = await sb.from('listings').select('slug').like('slug', base + '%');
    if (taken.error) throw new Error(taken.error.message);
    var used = {}; (taken.data || []).forEach(function (r) { used[r.slug] = true; });
    var n = 2; while (used[base + '-' + n]) n++;
    var row = { slug: base + '-' + n, release_id: l.release_id, section: l.section, status: 'draft', price_cents: l.price_cents,
      currency: l.currency, condition_media: l.condition_media, condition_media_b: l.condition_media_b, sleeve_type: l.sleeve_type,
      condition_sleeve: l.condition_sleeve, condition_notes: l.condition_notes, notes: l.notes, photo_keys: l.photo_keys,
      weight_g: l.weight_g, custom_title: l.custom_title };
    var res = await sb.from('listings').insert(row).select('id,sku').single();
    if (res.error) throw new Error(res.error.message);
    return res.data;
  }

  // ── Attributes ────────────────────────────────────────────────────────────
  /* Figma BACKEND → Attributes (2123:2053, Gio 2026-11-10, decision 0034): one page with tabs Artists · Labels ·
     Genres · Tags (count = tab suffix, 0029), same grammar as Listings (toolbar, bulk bar always rendered, table
     whose first column selects). Each entity has its own page (same layout as Create listing). Database: migration
     0012 (admin_attributes, admin_entity, admin_save_entity, admin_replace_entity, admin_merge_entities, admin_delete_entities).
     Routes: #attributes/<kind> · #attributes/<kind>/<id> · #attributes/<kind>/new */
  var KINDS = [
    { key: 'artist', list: 'artists', tab: 'Artists', one: 'artist', aliases: true, discogs: true, split: true, search: 'Search name or spelling' },
    { key: 'label', list: 'labels', tab: 'Labels', one: 'label', aliases: true, discogs: true, split: false, search: 'Search name or spelling' },
    { key: 'genre', list: 'genres', tab: 'Genres', one: 'genre', aliases: false, discogs: false, split: true, search: 'Search genres' },
    { key: 'tag', list: 'tags', tab: 'Tags', one: 'tag', aliases: false, discogs: false, split: true, search: 'Search tags' }
  ];
  function kindOf(key) {
    if (key === 'subgenre') key = 'genre';   // links saved before 0048
    return KINDS.filter(function (k) { return k.key === key; })[0] || KINDS[0];
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function quoted(list) {
    var names = list.slice(0, 5).map(function (x) { return '“' + x + '”'; });
    if (list.length > 5) return names.join(', ') + ' and ' + (list.length - 5) + ' more';
    return names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
  }
  // a database error "field: message" → { field, text }
  function fieldError(msg) { var m = /^(name|slug|discogs_id): (.*)$/.exec(msg || ''); return m ? { field: m[1], text: cap(m[2]) + '.' } : null; }
  // Merge: pre-selected = the one with a Discogs ID, then the most records (Figma notes)
  function bestToKeep(rows) {
    return rows.slice().sort(function (a, b) { return (b.discogs_id ? 1 : 0) - (a.discogs_id ? 1 : 0) || b.records - a.records; })[0];
  }

  function Attributes(props) {
    var mobile = useIsMobile();
    var kind = kindOf(props.kind);
    var st = useState(null), data = st[0], setData = st[1];
    var er = useState(null), error = er[0], setError = er[1];
    var qs = useState(''), query = qs[0], setQuery = qs[1];
    var se = useState([]), selected = se[0], setSelected = se[1];
    var ms = useState(null), message = ms[0], setMessage = ms[1];
    var bs = useState(false), busy = bs[0], setBusy = bs[1];
    var cf = useState(null), confirm = cf[0], setConfirm = cf[1];
    var kp = useState(null), keep = kp[0], setKeep = kp[1];

    function load() {
      return sb.rpc('admin_attributes').then(function (res) { if (res.error) setError(res.error.message); else setData(res.data); });
    }
    useEffect(function () { load(); }, []);
    if (error) return h('p', { className: 'body-medium admin-status--error', role: 'alert' }, 'Could not load the attributes: ' + error);
    if (!data) return h('p', { className: 'body-medium' }, 'Loading…');

    var rows = data[kind.list] || [];
    var q = query.trim().toLowerCase();
    var visible = q ? rows.filter(function (r) {
      return r.name.toLowerCase().indexOf(q) >= 0 || (r.aliases || []).some(function (a) { return a.toLowerCase().indexOf(q) >= 0; });
    }) : rows;
    var picked = visible.filter(function (r) { return selected.indexOf(r.id) >= 0; });
    var allOn = visible.length > 0 && picked.length === visible.length;
    var someOn = picked.length > 0 && !allOn;

    function pickTab(v) { setSelected([]); setMessage(null); setQuery(''); location.hash = '#attributes/' + v; }
    function toggle(id, on) { setSelected(function (cur) { return on ? cur.concat([id]) : cur.filter(function (x) { return x !== id; }); }); }
    function toggleAll() { setSelected(allOn ? [] : visible.map(function (r) { return r.id; })); }

    function askDelete() {
      var free = picked.filter(function (r) { return !r.records; }), linked = picked.filter(function (r) { return r.records; });
      if (!free.length) {
        setMessage({ error: true, text: (picked.length === 1 ? '“' + picked[0].name + '” is' : 'All of them are') +
          ' on records: open ' + (picked.length === 1 ? 'it' : 'each one') + ' and use Replace with to move the records first.' });
        return;
      }
      setConfirm({ action: 'delete', free: free, linked: linked });
    }
    function askMerge() {
      setKeep(bestToKeep(picked).id);
      setConfirm({ action: 'merge', rows: picked });
    }
    async function confirmed() {
      var c = confirm;
      setBusy(true);
      var res = c.action === 'delete'
        ? await sb.rpc('admin_delete_entities', { p_kind: kind.key, p_ids: c.free.map(function (r) { return r.id; }) })
        : await sb.rpc('admin_merge_entities', { p_kind: kind.key, p_keep: keep, p_others: c.rows.filter(function (r) { return r.id !== keep; }).map(function (r) { return r.id; }) });
      setBusy(false);
      setConfirm(null);
      if (res.error) { setMessage({ error: true, text: 'Nothing changed: ' + res.error.message }); return; }
      setSelected([]);
      await load();
      if (c.action === 'delete') {
        var gone = res.data.deleted.length, skipped = res.data.skipped.length;
        setMessage(null);
        toast((gone === 1 ? '“' + c.free[0].name + '” deleted.' : plural(gone, kind.one) + ' deleted.') +
          (skipped ? ' ' + plural(skipped, kind.one) + ' skipped (on records).' : ''));
      } else {
        var kept = c.rows.filter(function (r) { return r.id === keep; })[0];
        setMessage(null);
        toast(plural(c.rows.length - 1, kind.one) + ' merged into “' + kept.name + '”.' +
          (kind.key === 'genre' || kind.key === 'tag' ? ' The shop updates in about 2 minutes.' : ''));
      }
    }

    var bar = h('div', { className: 'admin-bulk' },
      h('p', { className: 'admin-bulk__count body-medium', 'aria-live': 'polite' }, picked.length + ' selected'),
      picked.length
        ? h('div', { className: 'admin-bulk__actions' },
            picked.length > 1 ? h(Z.Button, { hierarchy: 'secondary', 'aria-busy': busy || undefined, onClick: busy ? undefined : askMerge }, 'Merge') : null,
            h(Z.Button, { hierarchy: 'secondary', 'aria-busy': busy || undefined, onClick: busy ? undefined : askDelete }, 'Delete'))
        : null,
      h('div', { className: 'admin-bulk__message', role: 'status', hidden: !!picked.length },
        message ? h('span', { className: 'body-medium' + (message.error ? ' admin-status--error' : '') }, message.text) : null));

    var dialog;
    if (confirm && confirm.action === 'delete') {
      var n = confirm.free.length, sk = confirm.linked;
      var body = quoted(confirm.free.map(function (r) { return r.name; })) + (n === 1 ? ' is' : ' are') + ' removed. ' +
        (n === 1 ? 'It is' : 'They are') + ' not on any record.';
      if (sk.length) body += ' ' + quoted(sk.map(function (r) { return r.name; })) + (sk.length === 1 ? ' is' : ' are') + ' skipped: ' +
        (sk.length === 1 ? 'it is' : 'they are') + ' on records. Open ' + (sk.length === 1 ? 'it' : 'each one') + ' and use Replace with to move ' + (sk.length === 1 ? 'them' : 'their records') + ' first.';
      dialog = h(Z.Dialog, { open: true, busy: busy, title: 'Delete ' + plural(n, kind.one) + '?', confirmLabel: 'Delete ' + plural(n, kind.one),
        onCancel: function () { setConfirm(null); }, onConfirm: confirmed }, h('p', null, body));
    } else if (confirm && confirm.action === 'merge') {
      var m = confirm.rows.length, others = m - 1;
      dialog = h(Z.Dialog, { open: true, busy: busy, title: 'Merge ' + plural(m, kind.one) + '?', confirmLabel: 'Merge ' + plural(m, kind.one),
        onCancel: function () { setConfirm(null); }, onConfirm: confirmed,
        choices: h(Z.RadioGroup, { legend: 'Keep which ' + kind.one, hideLegend: true, value: keep, onValueChange: setKeep },
          confirm.rows.map(function (r) {
            return h(Z.Radio, { key: r.id, value: r.id, label: [r.name, plural(r.records, 'record')].concat(r.discogs_id ? ['Discogs ' + r.discogs_id] : []).join(' · ') });
          })) },
        h('p', null, 'Keep one. ' + (others === 1 ? 'The other’s records move' : 'The others’ records move') + ' to it' +
          (kind.aliases ? ', ' + (others === 1 ? 'its name and spellings become' : 'their names and spellings become') + ' aliases' : '') +
          ', then ' + (others === 1 ? 'it is' : 'they are') + ' deleted.'));
    } else dialog = h(Z.Dialog, { open: false, title: '', confirmLabel: '', onCancel: function () {}, onConfirm: function () {} }, '');

    var cols = kind.aliases ? ['Name', 'Also written as', 'Discogs', 'Records'] : ['Name', 'Records'];
    return h('div', { className: 'admin-section admin-listings' },
      h('h1', { className: 'label-extra-large' }, 'Attributes'),
      h(Z.Tabs, { value: kind.key, onValueChange: pickTab, 'aria-label': 'Attribute type' },
        KINDS.map(function (k) { return h(Z.Tab, { key: k.key, value: k.key, suffix: String((data[k.list] || []).length), 'aria-controls': 'attributes-table' }, k.tab); })),
      h('div', { className: 'admin-toolbar' },
        h(Z.Input, { className: 'admin-toolbar__search', variant: 'search', 'aria-label': kind.search, placeholder: kind.search, value: query,
          onChange: function (e) { setQuery(e.target.value); setSelected([]); } }),
        h(Z.Button, { hierarchy: 'secondary', href: '#attributes/' + kind.key + '/new' }, 'New ' + kind.one)),
      mobile ? h('ul', { id: 'attributes-table', className: 'admin-rows' }, visible.length ? visible.map(function (r) {
        var meta = (kind.aliases ? [(r.aliases || []).length ? 'Also ' + r.aliases.join(', ') : null, r.discogs_id ? 'Discogs ' + r.discogs_id : null] : [])
          .concat([plural(r.records, 'record')]).filter(Boolean).join(' · ');
        return h(Z.ListingRow, { key: r.id, href: '#attributes/' + kind.key + '/' + r.id, title: r.name, meta: meta,
          select: h(Z.Checkbox, { id: 'select-' + r.id, hideLabel: true, label: 'Select ' + r.name,
            checked: selected.indexOf(r.id) >= 0, onChange: function (e) { toggle(r.id, e.target.checked); } }) });
      }) : h('li', { className: 'body-small admin-rows__empty' }, q ? 'Nothing matches “' + query.trim() + '”.' : 'No ' + kind.list + ' yet.')) : bar,
      mobile ? bar : h('div', { className: 'admin-table-wrap' },
        h('table', { id: 'attributes-table', className: 'admin-table body-small' },
          h('thead', null, h('tr', null,
            h('th', { className: 'select' }, visible.length ? h(Z.Checkbox, { id: 'select-all', hideLabel: true, label: 'Select all', checked: allOn, indeterminate: someOn, onChange: toggleAll }) : null),
            cols.map(function (t) { return h('th', { key: t, className: t === 'Records' ? 'num price' : '' }, t); }))),
          h('tbody', null, visible.length ? visible.map(function (r) {
            return h('tr', { key: r.id },
              h('td', { className: 'select' }, h(Z.Checkbox, { id: 'select-' + r.id, hideLabel: true, label: 'Select ' + r.name,
                checked: selected.indexOf(r.id) >= 0, onChange: function (e) { toggle(r.id, e.target.checked); } })),
              h('td', null, h('a', { href: '#attributes/' + kind.key + '/' + r.id }, r.name)),
              kind.aliases ? h('td', null, (r.aliases || []).join(', ') || '—') : null,
              kind.aliases ? h('td', { className: 'num' }, r.discogs_id || '—') : null,
              h('td', { className: 'num price' }, r.records));
          }) : h('tr', null, h('td', { colSpan: cols.length + 1 }, q ? 'Nothing matches “' + query.trim() + '”.' : 'No ' + kind.list + ' yet.'))))),
      dialog);
  }

  /* Figma BACKEND → Attributes › Artist - desktop · edit (2123:3216) and · split confirm (2123:4664) */
  function AttributeForm(props) {
    var mobile = useIsMobile();
    var kind = kindOf(props.kind), isNew = props.id === 'new';
    var st = useState(null), f = st[0], setF = st[1];
    var ls = useState(null), lists = ls[0], setLists = ls[1];
    var rs = useState([]), records = rs[0], setRecords = rs[1];
    var cs = useState(0), n = cs[0], setCount = cs[1];   // records = listings on it (from the database, not from the loaded rows)
    var er = useState(null), error = er[0], setError = er[1];
    var fe = useState({}), errors = fe[0], setErrors = fe[1];
    var ms = useState(null), message = ms[0], setMessage = ms[1];
    var sv = useState(false), saving = sv[0], setSaving = sv[1];
    var rp = useState([]), replace = rp[0], setReplace = rp[1];
    var cf = useState(null), confirm = cf[0], setConfirm = cf[1];
    var slugTouched = useRef(!isNew);

    useEffect(function () {
      sb.rpc('admin_attributes').then(function (res) { if (!res.error) setLists(res.data); });
      if (isNew) { setF({ name: '', slug: '', discogs: '', aliases: [] }); return; }
      sb.rpc('admin_entity', { p_kind: kind.key, p_id: props.id }).then(function (res) {
        if (res.error) { setError(res.error.message); return; }
        var e = res.data;
        setF({ name: e.name, slug: e.slug, discogs: e.discogs_id ? String(e.discogs_id) : '',
               aliases: (e.aliases || []).map(function (a) { return { id: null, name: a }; }) });
        setCount(e.listing_ids.length);
        if (e.listing_ids.length) {
          sb.from('listings').select('id,sku,slug,status,reserved_until,custom_title,release:releases(lines:release_lines(position,artist,title))')
            .in('id', e.listing_ids).order('created_at', { ascending: false })
            .then(function (r2) { if (!r2.error) setRecords(r2.data); });
        }
      });
    }, []);
    if (error) return h('p', { className: 'body-medium admin-status--error', role: 'alert' }, 'Could not open this ' + kind.one + ': ' + error);
    if (!f) return h('p', { className: 'body-medium' }, 'Loading…');

    function set(patch) { setF(function (cur) { return Object.assign({}, cur, patch); }); }
    function setName(e) {
      var v = e.target.value;
      set(slugTouched.current ? { name: v } : { name: v, slug: v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') });
    }
    async function save() {
      var e = {};
      if (!f.name.trim()) e.name = 'Enter a name.';
      if (f.discogs.trim() && !/^\d+$/.test(f.discogs.trim())) e.discogs_id = 'Use the number only, e.g. 50582.';
      setErrors(e);
      if (Object.keys(e).length) { setMessage({ error: true, text: 'Check the highlighted fields.' }); return; }
      setSaving(true); setMessage(null);
      var res = await sb.rpc('admin_save_entity', { p_kind: kind.key, p_id: isNew ? null : props.id,
        p: { name: f.name, slug: f.slug, discogs_id: f.discogs.trim(), aliases: f.aliases.map(function (a) { return a.name; }) } });
      setSaving(false);
      if (res.error) {
        var fe2 = fieldError(res.error.message);
        if (fe2) { var x = {}; x[fe2.field] = fe2.text; setErrors(x); setMessage({ error: true, text: fe2.text }); }
        else setMessage({ error: true, text: 'Not saved: ' + res.error.message });
        return;
      }
      if (isNew) { location.hash = '#attributes/' + kind.key + '/' + res.data; return; }
      setMessage({ error: false, text: 'Saved.' + (kind.key === 'genre' || kind.key === 'tag' ? ' The shop updates in about 2 minutes.' : '') });
    }
    async function doDelete() {
      setSaving(true);
      var res = await sb.rpc('admin_delete_entities', { p_kind: kind.key, p_ids: [props.id] });
      setSaving(false); setConfirm(null);
      if (res.error) { setMessage({ error: true, text: 'Not deleted: ' + res.error.message }); return; }
      if (!res.data.deleted.length) { setMessage({ error: true, text: 'Not deleted: it is on records.' }); return; }
      location.hash = '#attributes/' + kind.key;
    }
    async function doReplace() {
      setSaving(true);
      // a new name typed in Replace with is created first (same as in Create listing)
      var ids = [];
      for (var i = 0; i < replace.length; i++) {
        if (replace[i].id) { ids.push(replace[i].id); continue; }
        var c = await sb.rpc('admin_save_entity', { p_kind: kind.key, p_id: null, p: { name: replace[i].name } });
        if (c.error) { setSaving(false); setConfirm(null); setMessage({ error: true, text: 'Nothing changed: ' + c.error.message }); return; }
        ids.push(c.data);
      }
      var res = await sb.rpc('admin_replace_entity', { p_kind: kind.key, p_id: props.id, p_targets: ids });
      setSaving(false); setConfirm(null);
      if (res.error) { setMessage({ error: true, text: 'Nothing changed: ' + res.error.message }); return; }
      location.hash = '#attributes/' + kind.key + '/' + ids[0];
    }

    var options = lists ? (lists[kind.list] || []).filter(function (x) { return x.id !== props.id; })
      .map(function (x) { return { id: x.id, name: x.name, aliases: x.aliases || [] }; }) : null;
    var title = isNew ? 'New ' + kind.one : (f.name.trim() || cap(kind.one));

    var main = h('div', { className: 'admin-main' },
      h('h1', { className: 'label-extra-large' }, title),
      h('section', { className: 'admin-section' },
        h('div', { className: 'admin-row' },
          h(Z.Input, { className: 'span-8', id: 'name', label: 'Name', value: f.name, onChange: setName, error: errors.name,
            supportText: kind.key === 'artist' || kind.key === 'label' ? 'Official name. The shop shows each record’s credit as printed.' : undefined })),
        kind.aliases ? h('div', { className: 'admin-row' },
          h(Z.EntityField, { className: 'span-8', id: 'aliases', label: 'Also written as', optional: true, placeholder: 'Add a spelling',
            options: [], createLabel: 'Add', value: f.aliases, onChange: function (chips) { set({ aliases: chips }); },
            supportText: 'Typing one of these in a listing suggests this ' + kind.one + '.' })) : null,
        h('div', { className: 'admin-row' },
          kind.discogs ? h(Z.Input, { className: 'span-4', id: 'discogs-id', label: 'Discogs ID', optional: true, inputMode: 'numeric',
            value: f.discogs, error: errors.discogs_id, onChange: function (e) { set({ discogs: e.target.value }); } }) : null,
          h(Z.Input, { className: 'span-4', id: 'slug', label: 'Slug', value: f.slug, error: errors.slug,
            onChange: function (e) { slugTouched.current = true; set({ slug: e.target.value }); },
            supportText: f.slug ? 'Page address: /' + kind.list + '/' + f.slug : 'Made from the name on save.' }))),
      isNew ? null : h(Z.Divider),
      isNew ? null : h('section', { className: 'admin-section', 'aria-labelledby': 'records-title' },
        h('h2', { id: 'records-title', className: 'label-medium' }, 'Records ' + n),   // Figma: one text "Records 2"
        n ? h('ul', { className: 'admin-links body-small' }, records.map(function (r) {
          return h('li', { key: r.id }, h('a', { href: '#edit-' + r.id }, [String(r.sku), nameOf(r), STATUS_LABEL[effectiveStatus(r)] || r.status].join(' · ')));
        })) : h('p', { className: 'body-small' }, 'Not on any record.')),
      isNew || !n ? null : h(Z.Divider),
      isNew || !n ? null : h('section', { className: 'admin-section', 'aria-labelledby': 'replace-title' },
        h('h2', { id: 'replace-title', className: 'label-medium' }, kind.split ? 'Merge or split' : 'Merge'),
        h('div', { className: 'admin-row' },
          h(Z.EntityField, { className: 'span-8', id: 'replace', label: 'Replace with', placeholder: 'Type ' + (kind.key === 'artist' ? 'an ' : 'a ') + kind.one,
            multiple: kind.split, options: options, value: replace, onChange: function (chips) { setReplace(chips); },
            supportText: kind.split
              ? 'Moves its records to the ' + kind.list + ' you pick, then deletes it. One ' + kind.one + ' = merge' + (kind.aliases ? ': its name and spellings become aliases' : '') + '. Two or more = split a combined name.'
              : 'Moves its records to the ' + kind.one + ' you pick, then deletes it. Its name and spellings become aliases.' })),
        h('div', null, h(Z.Button, { hierarchy: 'secondary', disabled: saving || !replace.length, onClick: function () { setConfirm('replace'); } }, 'Replace'))));

    var why = n ? 'On ' + plural(n, 'record') + ': ' + (kind.split ? 'merge or split it' : 'merge it into another ' + kind.one) + ' to remove it.' : null;
    var saveBtn = h(Z.Button, { key: 'save', hierarchy: 'primary', disabled: saving, onClick: save }, isNew ? 'Create' : 'Save');
    var otherBtn = isNew ? h(Z.Button, { key: 'cancel', hierarchy: 'secondary', href: '#attributes/' + kind.key }, 'Cancel')
              : h(Z.Button, { key: 'delete', hierarchy: 'secondary', disabled: saving || n > 0, 'aria-describedby': n ? 'delete-why' : undefined,
                  onClick: function () { setConfirm('delete'); } }, 'Delete');
    var statusLine = h('p', { className: 'admin-status body-small' + (message && message.error ? ' admin-status--error' : ''), role: 'status' }, message ? message.text : '');
    // mobile (decision 0089): the two actions in the ActionBar at the bottom, the side content follows the form
    var side = h('aside', { className: 'admin-side' },
      mobile ? null : h(Z.ActionPanel, null, saveBtn, otherBtn),
      why ? h('p', { id: 'delete-why', className: 'body-small' }, why) : null,
      mobile ? null : statusLine);

    var dialog;
    if (confirm === 'delete') {
      dialog = h(Z.Dialog, { open: true, busy: saving, title: 'Delete 1 ' + kind.one + '?', confirmLabel: 'Delete 1 ' + kind.one,
        onCancel: function () { setConfirm(null); }, onConfirm: doDelete }, h('p', null, '“' + f.name + '” is removed. It is not on any record.'));
    } else if (confirm === 'replace') {
      var targets = replace.map(function (x) { return x.name; }), split = replace.length > 1;
      var recText = n !== 1 ? 'Its ' + n + ' records are' : records[0] ? 'Its record “' + nameOf(records[0]) + '” is' : 'Its record is';
      var how = kind.key === 'artist' ? 'credited to' : kind.key === 'label' ? 'moved to' : 'tagged';
      dialog = h(Z.Dialog, { open: true, busy: saving,
        title: (split ? 'Split into ' + plural(replace.length, kind.one) : 'Merge into “' + targets[0] + '”') + '?',
        confirmLabel: split ? 'Split and delete' : 'Merge and delete',
        onCancel: function () { setConfirm(null); }, onConfirm: doReplace },
        h('p', null, recText + ' ' + how + ' ' + quoted(targets) + ', then “' + f.name + '” is deleted.' +
          (!split && kind.aliases ? ' “' + f.name + '” and its spellings become aliases of “' + targets[0] + '”.' : '') +
          (kind.key === 'artist' || kind.key === 'label' ? ' The credit printed on the record does not change.' : ' The shop updates in about 2 minutes.')));
    } else dialog = h(Z.Dialog, { open: false, title: '', confirmLabel: '', onCancel: function () {}, onConfirm: function () {} }, '');

    return h('div', { className: 'admin-page admin-page--attribute' }, main, side,
      mobile ? h(Z.ActionBar, { status: statusLine }, saveBtn, otherBtn) : null, dialog);
  }

  // ── Sign-in ───────────────────────────────────────────────────────────────
  function SignIn() {
    var st = useState(''), email = st[0], setEmail = st[1];
    var ss = useState(null), state = ss[0], setState = ss[1];
    async function send(e) {
      e.preventDefault();
      if (!/^\S+@\S+\.\S+$/.test(email)) { setState({ error: 'Enter your email address.' }); return; }
      setState({ sending: true });
      var res = await sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname } });
      setState(res.error ? { error: res.error.message } : { sent: true });
    }
    return h('form', { className: 'admin-signin', onSubmit: send, noValidate: true },
      h('h1', { className: 'label-extra-large' }, 'Sign in'),
      h(Z.Input, { id: 'email', label: 'Email', type: 'email', autoComplete: 'email', value: email, onChange: function (e) { setEmail(e.target.value); },
        error: state && state.error, supportText: state && state.sent ? 'Check your inbox: the link signs you in on this browser.' : 'We email you a sign-in link.' }),
      h('div', null, h(Z.Button, { hierarchy: 'primary', type: 'submit', disabled: state && state.sending }, 'Send link')));
  }

  // ── Content ───────────────────────────────────────────────────────────────
  /* Figma BACKEND → Content (2337:4277, decision 0106): the shop's texts in Gio's own voice. The blocks, their fields
     and today's texts (the defaults) come from packages/content/content.js (window.ZanzaContent, built by build.js).
     A block = one row of public.site_texts (migration 0025); Save = admin_set_text, which also rebuilds the shop.
     Routes: #content (the list), #content/<key> (an editor). */
  var CT = window.ZanzaContent;
  var CONDITION = {
    'identity-on': 'Shown while \u201cShow who I am\u201d is on',
    'identity-off': 'Shown while \u201cShow who I am\u201d is off',
    trade: 'Trade only: hidden on the shop while trade is off'
  };
  function editedText(at) {
    if (!at) return undefined;
    try { return 'Edited ' + new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return undefined; }
  }
  function shopHref(path) { return CFG.storefrontUrl ? CFG.storefrontUrl.replace(/\/$/, '') + path : null; }
  function copyOf(v) { return JSON.parse(JSON.stringify(v)); }

  function Content() {
    var rs = useState(null), rows = rs[0], setRows = rs[1];
    var es = useState(null), error = es[0], setError = es[1];
    useEffect(function () {
      sb.from('site_texts').select('key,updated_at').then(function (res) {
        if (res.error) setError(res.error.message); else setRows(res.data || []);
      });
    }, []);
    var edited = {};
    (rows || []).forEach(function (r) { edited[r.key] = r.updated_at; });
    return h('div', { className: 'admin-section admin-content' },
      h('h1', { className: 'label-extra-large' }, 'Content'),
      h('p', { className: 'body-small' }, 'The texts of the shop, in your words. Saving a text rebuilds the shop: live in about 2 minutes.'),
      error ? h('p', { className: 'body-small admin-status--error', role: 'alert' }, 'Could not read the saved texts: ' + error + '. Is migration 0025 (site texts) applied? The list shows today\u2019s texts.') : null,
      !rows && !error ? h('p', { className: 'body-small' }, 'Loading…') : CT.GROUPS.map(function (g) {
        return h('section', { key: g.id, className: 'admin-content__group', 'aria-labelledby': 'content-' + g.id },
          h(Z.ContentGroupHead, { heading: g.title, headingId: 'content-' + g.id, help: g.help }),
          h('ul', { className: 'admin-rows' }, CT.BLOCKS.filter(function (b) { return b.group === g.id; }).map(function (b) {
            return h(Z.ContentRow, { key: b.key, title: b.title, where: b.where, edited: editedText(edited[b.key]),
              condition: CONDITION[b.shows], href: '#content/' + b.key });
          })));
      }));
  }

  function ContentEditor(props) {
    var key = props.blockKey, block = CT.blockOf(key);
    var mobile = useIsMobile();
    var vs = useState(null), value = vs[0], setValue = vs[1];
    var ss = useState(null), saved = ss[0], setSaved = ss[1];      // JSON of the last saved (or loaded) value
    var ps = useState([]), problems = ps[0], setProblems = ps[1];
    var ls = useState(null), loadError = ls[0], setLoadError = ls[1];
    var bs = useState(false), busy = bs[0], setBusy = bs[1];
    useEffect(function () {
      if (!block) return;
      sb.from('site_texts').select('value').eq('key', key).maybeSingle().then(function (res) {
        if (res.error) setLoadError(res.error.message);
        var v = copyOf(CT.DEFAULTS[key] || {});
        var row = res.data && res.data.value;
        if (row) block.fields.forEach(function (f) { if (row[f.name] !== undefined && row[f.name] !== null) v[f.name] = row[f.name]; });
        setValue(v); setSaved(JSON.stringify(v));
      });
    }, [key]);
    if (!block) return h('p', { className: 'body-medium' }, 'This text does not exist. ', h('a', { href: '#content' }, 'Back to Content'));
    if (!value) return h('p', { className: 'body-small' }, 'Loading…');

    var dirty = JSON.stringify(value) !== saved;
    function set(name, v) { setValue(function (cur) { var n = Object.assign({}, cur); n[name] = v; return n; }); setProblems([]); }
    async function save() {
      if (busy) return;
      if (!dirty) { toast('Nothing to save.'); return; }
      var clean = copyOf(value);
      block.fields.forEach(function (f) {
        if (f.kind === 'text' || f.kind === 'textarea') clean[f.name] = String(clean[f.name] || '').trim();
        if (f.kind === 'links') clean[f.name] = (clean[f.name] || []).map(function (l) { return { label: String(l.label || '').trim(), href: String(l.href || '').trim() }; })
          .filter(function (l) { return l.label || l.href; });
        if (f.kind === 'sections') clean[f.name] = (clean[f.name] || []).map(function (x) { return { heading: String(x.heading || '').trim(), text: String(x.text || '').trim() }; })
          .filter(function (x) { return x.heading || x.text; });
        if (f.kind === 'steps') clean[f.name] = (clean[f.name] || []).map(function (x) { return { title: String(x.title || '').trim(), text: String(x.text || '').trim() }; })
          .filter(function (x) { return x.title || x.text; });
        if (f.kind === 'number') clean[f.name] = /^\d+$/.test(String(clean[f.name]).trim()) ? parseInt(clean[f.name], 10) : clean[f.name];
      });
      var found = CT.problems(key, clean);
      if (found.length) { setProblems(found); return; }
      setBusy(true);
      var res = await sb.rpc('admin_set_text', { p_key: key, p_value: clean });
      setBusy(false);
      if (res.error) { setProblems(['Not saved: ' + res.error.message]); return; }
      setValue(clean); setSaved(JSON.stringify(clean));
      toast('Saved. The shop updates in about 2 minutes.');
    }

    var view = block.path && shopHref(block.path);
    var viewBtn = view ? h(Z.Button, { key: 'view', hierarchy: 'secondary', href: view, target: '_blank', rel: 'noopener' }, 'View on shop',
      h('span', { 'aria-hidden': 'true' }, ' \u2197'), h('span', { className: 'zz-visually-hidden' }, ' (opens in a new tab)')) : null;
    var saveBtn = h(Z.Button, { key: 'save', hierarchy: 'primary', 'aria-busy': busy || undefined, onClick: save }, 'Save');
    var status = problems.length ? h('ul', { className: 'body-small admin-status--error admin-content__problems', role: 'alert' },
      problems.map(function (p, i) { return h('li', { key: i }, p); })) : null;
    var shownSection = {};

    return h('div', { className: 'admin-section admin-content admin-content-editor' },
      h(Z.ContentEditorHead, { backHref: '#content', title: block.title, where: 'Shown on: ' + block.where + (block.shows ? ' \u00b7 ' + CONDITION[block.shows].toLowerCase() : ''),
        actions: mobile ? null : h(React.Fragment, null, viewBtn, saveBtn) }),
      loadError ? h('p', { className: 'body-small admin-status--error', role: 'alert' }, 'Could not read the saved text (' + loadError + '): showing today\u2019s text.') : null,
      mobile ? null : status,
      h('div', { className: 'admin-content__form' }, block.fields.map(function (f) {
        var head = f.section && !shownSection[f.section] ? (shownSection[f.section] = true, h(Z.ContentGroupHead, { key: 'h-' + f.name, heading: f.section, help: f.sectionHelp, headingLevel: 2 })) : null;
        return h(React.Fragment, { key: f.name }, head, h(ContentField, { field: f, value: value[f.name], onChange: function (v) { set(f.name, v); }, blockKey: key }));
      })),
      mobile ? h(Z.ActionBar, { status: status }, saveBtn, viewBtn) : null);
  }

  function ContentField(props) {
    var f = props.field, v = props.value, id = 'content-' + props.blockKey.replace('.', '-') + '-' + f.name;
    function list(items, make) { return (items || []).map(make); }
    function update(items, i, patch) { var n = (items || []).slice(); n[i] = Object.assign({}, n[i], patch); props.onChange(n); }
    function removeAt(items, i) { var n = (items || []).slice(); n.splice(i, 1); props.onChange(n); }
    if (f.kind === 'text') return h(Z.Input, { id: id, label: f.label, value: v || '', supportText: f.help, onChange: function (e) { props.onChange(e.target.value); } });
    if (f.kind === 'textarea') return h(Z.Input, { id: id, variant: 'text-area', label: f.label, value: v || '', supportText: f.help, rows: 4, onChange: function (e) { props.onChange(e.target.value); } });
    if (f.kind === 'number') return h(Z.Input, { id: id, label: f.label, value: v === undefined || v === null ? '' : String(v), inputMode: 'numeric', supportText: f.help, onChange: function (e) { props.onChange(e.target.value); } });
    if (f.kind === 'links') return h('div', { className: 'admin-content__list', role: 'group', 'aria-labelledby': id + '-head' },
      h(Z.ContentGroupHead, { heading: f.label, headingId: id + '-head', help: f.help }),
      list(v, function (l, i) {
        return h(Z.LinkRow, { key: i, layout: 'stacked', onRemove: function () { removeAt(v, i); },
          label: h(Z.Input, { id: id + '-' + i + '-label', label: 'Label', value: l.label || '', onChange: function (e) { update(v, i, { label: e.target.value }); } }),
          link: h(Z.Input, { id: id + '-' + i + '-href', label: 'Link', type: 'url', value: l.href || '', placeholder: 'https://…', onChange: function (e) { update(v, i, { href: e.target.value }); } }) });
      }),
      h('div', null, h(Z.Button, { hierarchy: 'secondary', type: 'button', onClick: function () { props.onChange((v || []).concat([{ label: '', href: '' }])); } }, 'Add link')));
    if (f.kind === 'sections' || f.kind === 'steps') {
      var steps = f.kind === 'steps';
      return h('div', { className: 'admin-content__list admin-content__sections' },
        h('p', { className: 'body-small' }, steps ? 'The steps in the order the page numbers them.'
          : 'The page is shown in this order, top to bottom: one box per section. The page title stays fixed. **bold** and [link](/contact/) work in the text; lines starting with “- ” make a list.'),
        list(v, function (x, i) {
          var n = i + 1;
          return h(Z.SectionRow, { key: i, onRemove: (v || []).length > 1 ? function () { removeAt(v, i); } : undefined,
            heading: h(Z.Input, { id: id + '-' + i + '-h', label: steps ? 'Step ' + n : 'Section ' + n + ' \u00b7 heading', optional: !steps && i === 0,
              value: (steps ? x.title : x.heading) || '', onChange: function (e) { update(v, i, steps ? { title: e.target.value } : { heading: e.target.value }); } }),
            text: h(Z.Input, { id: id + '-' + i + '-t', variant: 'text-area', rows: 5, label: steps ? 'Text' : 'Section ' + n + ' \u00b7 text', value: x.text || '',
              supportText: /\{\{|\[\[p:/.test(x.text || '') ? 'Keep {{…}} as it is: the shop fills it in. [[p:…]] = a value still to confirm.' : undefined,
              onChange: function (e) { update(v, i, { text: e.target.value }); } }) });
        }),
        h('div', null, h(Z.Button, { hierarchy: 'secondary', type: 'button', onClick: function () {
          props.onChange((v || []).concat([steps ? { title: '', text: '' } : { heading: '', text: '' }]));
        } }, steps ? 'Add step' : 'Add section')));
    }
    return null;
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  /* Figma BACKEND → Settings (2324:1064, decision 0102): switches for the whole shop. Trade = public.shop_settings
     (migration 0023), the single source of truth: off = the shop shows no trace of trade (pages, links, records,
     legal passages) and the server refuses offers. Save = admin_set_trade_enabled, which also rebuilds the shop.
     Route: #settings */
  var tradeSetting = null;   // one read per admin session, shared by Settings and the listing form
  // shop_settings (select * : works before and after migration 0025). trade = effective (off while identity is off),
  // tradeWanted = the Trade tick, identity = Who I am (decision 0106)
  function loadShopSettings() {
    return sb.from('shop_settings').select('*').maybeSingle().then(function (res) {
      if (res.error) throw res.error;
      var d = res.data || {};
      return { trade: d.trade_enabled !== false, tradeWanted: d.trade_wanted !== undefined ? d.trade_wanted !== false : d.trade_enabled !== false,
               identity: d.identity_enabled !== false, hasIdentity: d.identity_enabled !== undefined };
    });
  }
  function loadTradeEnabled(force) {
    if (!tradeSetting || force) {
      tradeSetting = loadShopSettings().then(function (st) { return st.trade; });
      tradeSetting.catch(function () { tradeSetting = null; });
    }
    return tradeSetting;
  }
  // the listing form: true / false, or null while unknown (then For trade stays offered, as before)
  function useTradeEnabled() {
    var st = useState(null), on = st[0], setOn = st[1];
    useEffect(function () { loadTradeEnabled().then(setOn, function () { setOn(null); }); }, []);
    return on;
  }

  function Settings() {
    var ss = useState(null), saved = ss[0], setSaved = ss[1];     // what the database says: { tradeWanted, identity, hasIdentity }
    var ts = useState(null), trade = ts[0], setTrade = ts[1];     // the Trade tick
    var is = useState(null), identity = is[0], setIdentity = is[1];   // the Who I am tick (decision 0106)
    var er = useState(null), error = er[0], setError = er[1];
    var ps = useState(null), problem = ps[0], setProblem = ps[1];
    var bs = useState(false), busy = bs[0], setBusy = bs[1];

    useEffect(function () {
      loadShopSettings().then(function (st) { setSaved(st); setTrade(st.tradeWanted); setIdentity(st.identity); }, function (e) { setError(e.message || String(e)); });
    }, []);
    if (error) return h('p', { className: 'body-medium admin-status--error', role: 'alert' },
      'Could not load the settings: ' + error + '. Is migration 0023 (trade switch) applied?');
    if (saved === null) return h('p', { className: 'body-medium' }, 'Loading…');

    async function save() {
      var identityChanged = identity !== saved.identity, tradeChanged = trade !== saved.tradeWanted;
      if (!identityChanged && !tradeChanged) { toast('Nothing to save.'); return; }
      setBusy(true);
      var res = identityChanged ? await sb.rpc('admin_set_identity_enabled', { p_enabled: identity }) : { error: null };
      if (!res.error && tradeChanged) res = await sb.rpc('admin_set_trade_enabled', { p_enabled: trade });
      setBusy(false);
      if (res.error) { setProblem('Not saved: ' + res.error.message); loadShopSettings().then(setSaved, function () {}); return; }
      var next = { tradeWanted: trade, identity: identity, hasIdentity: saved.hasIdentity };
      setProblem(null); setSaved(next); tradeSetting = Promise.resolve(trade && identity);
      toast((identityChanged ? (identity ? 'The shop shows who you are.' : 'The shop no longer shows who you are, nor trade.') : (trade ? 'Trade is on.' : 'Trade is off.')) + ' It updates in about 2 minutes.');
    }

    return h('div', { className: 'admin-section admin-shipping admin-settings' },
      h('h1', { className: 'label-extra-large' }, 'Settings'),
      h('div', { className: 'admin-toolbar' },
        h('p', { className: 'body-small admin-shipping__intro' }, 'Switches for the whole shop.'),
        h(Z.Button, { hierarchy: 'secondary', 'aria-busy': busy || undefined, onClick: busy ? undefined : save }, 'Save')),
      problem ? h('p', { className: 'body-small admin-status--error', role: 'alert' }, problem) : null,
      // Figma BACKEND → Settings → `identity setting` (decision 0106). Hidden until migration 0025 is applied.
      saved.hasIdentity ? h('section', { className: 'admin-shipping__section', 'aria-labelledby': 'settings-identity' },
        h('h2', { id: 'settings-identity', className: 'label-medium' }, 'Who I am'),
        h('p', { className: 'body-small', id: 'settings-identity-help' }, 'Off: the shop shows the Store profile and no trace of you: no name, DJ name, bio or signature, no Discogs card, no Instagram, Discogs or Facebook links (About, home, footer). Trade needs who you are, so it switches off too. Your texts stay in Content: switch on again and they are back. Saving rebuilds the shop, live in about 2 minutes.'),
        h('div', null, h(Z.Checkbox, { label: 'Show who I am on the shop', checked: identity, 'aria-describedby': 'settings-identity-help',
          onChange: function (e) { setIdentity(e.target.checked); setProblem(null); } }))) : null,
      // Figma BACKEND → Settings → `trade setting` (2324:1066)
      h('section', { className: 'admin-shipping__section', 'aria-labelledby': 'settings-trade' },
        h('h2', { id: 'settings-trade', className: 'label-medium' }, 'Trade'),
        h('p', { className: 'body-small', id: 'settings-trade-help' }, 'Off: the shop shows no trace of trade. The For trade section and its records, the offer form, How trading works and every mention (menus, footer, home, legal pages) disappear, and the server refuses offers. Trade listings stay here in the admin as they are: switch trade on again and they are back. Saving rebuilds the shop, live in about 2 minutes.' +
          (identity ? '' : ' While “Show who I am” is off, trade stays off whatever this says.')),
        h('div', null, h(Z.Checkbox, { label: 'Show trade on the shop', checked: trade, 'aria-describedby': 'settings-trade-help',
          onChange: function (e) { setTrade(e.target.checked); setProblem(null); } }))),
      h(PhotoSizes));
  }

  /* Settings → Photo sizes (decision 0108; not in Figma yet, design/open.md): makes the smaller copies of the photos
     uploaded before 2026-11-17, once. A photo whose last copy (images.js → lastKey) already loads is skipped; the
     others are read back from storage (needs GET in the R2 CORS policy), resized here and uploaded next to the photo.
     Nothing changes in the database: the shop finds the copies at its next rebuild. */
  function PhotoSizes() {
    var ss = useState(null), state = ss[0], setState = ss[1];   // null | { running, done, total, made, failed, error }
    async function run() {
      setState({ running: true, done: 0, total: 0, made: 0, failed: 0 });
      var res = await sb.from('listings').select('photo_keys');
      if (res.error) { setState({ error: 'Could not read the listings: ' + res.error.message }); return; }
      var keys = [];
      res.data.forEach(function (r) { (r.photo_keys || []).forEach(function (k) { if (IMG.hasSizes(k) && keys.indexOf(k) < 0) keys.push(k); }); });
      var made = 0, failed = 0, corsBlocked = false;
      for (var i = 0; i < keys.length; i++) {
        setState({ running: true, done: i, total: keys.length, made: made, failed: failed });
        var has = await loadImage(mediaUrl(IMG.lastKey(keys[i]))).then(function () { return true; }, function () { return false; });
        if (has) continue;
        var img;
        // own query string: the browser may hold this photo from an earlier, non-CORS load
        try { img = await loadImage(mediaUrl(keys[i]) + '?sizes=1', true); }
        catch (e) { failed++; if (made === 0 && failed >= 3) { corsBlocked = true; break; } continue; }
        try { await uploadSizes(keys[i], await sizedCopies(img, keys[i])); made++; }
        catch (e) { failed++; }
      }
      setState({ running: false, done: keys.length, total: keys.length, made: made, failed: failed,
                 error: corsBlocked ? 'Storage does not let the admin read the photos back. In Cloudflare → R2 → store-media → Settings → CORS policy, add "GET" to AllowedMethods, then try again.' : null });
    }
    var st = state || {};
    return h('section', { className: 'admin-shipping__section', 'aria-labelledby': 'settings-photo-sizes' },
      h('h2', { id: 'settings-photo-sizes', className: 'label-medium' }, 'Photo sizes'),
      h('p', { className: 'body-small', id: 'settings-photo-sizes-help' }, 'Every photo you upload gets smaller copies (' + IMG.WIDTHS.join(', ') + ' px), so cards, bag and player load light images. Photos uploaded before 17 November 2026 have none: make them here, once. The shop uses them from its next update (any listing you save or publish).'),
      st.error ? h('p', { className: 'body-small admin-status--error', role: 'alert' }, st.error) : null,
      h('p', { className: 'body-small', role: 'status' },
        st.running ? (st.total ? 'Checking photo ' + (st.done + 1) + ' of ' + st.total + '… ' + st.made + ' done.' : 'Reading the listings…')
        : state && !st.error && st.total !== undefined ? (st.made ? st.made + (st.made === 1 ? ' photo' : ' photos') + ' now have their sizes. ' : 'Every photo already has its sizes. ') + (st.failed ? st.failed + ' could not be read.' : '')
        : ''),
      h('div', null, h(Z.Button, { hierarchy: 'secondary', 'aria-busy': st.running || undefined, 'aria-describedby': 'settings-photo-sizes-help',
        onClick: st.running ? undefined : run }, 'Make photo sizes')));
  }

  // ── Shipping ──────────────────────────────────────────────────────────────
  /* Figma BACKEND → Shipping (2201:4782, 2026-11-12, decision 0057): formats (weight per record), packaging, zones,
     rates, and "Check an order" with the same maths as the shop (packages/shipping/shipping.js). One Save for the whole
     page = public.admin_save_shipping (migration 0015), which also rebuilds the shop (the bag carries the config).
     The form keeps text (what is typed); numbers are parsed on check and save. Route: #shipping */
  var SHIP = window.ZanzaShipping;
  var regionName = (function () {
    try { var dn = new Intl.DisplayNames(['en'], { type: 'region' }); return function (c) { try { return dn.of(c); } catch (e) { return c; } }; }
    catch (e) { return function (c) { return c; }; }
  })();
  function gramsText(g) { return g === null || g === undefined ? '' : String(g); }
  function kgText(g) { return g === null || g === undefined ? '' : String(g / 1000).replace('.', ','); }
  function toInt(t) { var s = String(t || '').trim(); return /^\d+$/.test(s) ? parseInt(s, 10) : NaN; }
  function kgToGrams(t) { var s = String(t || '').trim().replace(',', '.'); return /^\d+(\.\d{1,3})?$/.test(s) ? Math.round(parseFloat(s) * 1000) : NaN; }
  function codesOf(t) { return String(t || '').toUpperCase().split(/[\s,;]+/).filter(Boolean); }
  function shipKey() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function toForm(c) {
    return {
      formats: SHIP.FORMATS.map(function (f) {
        var row = (c.formats || []).filter(function (x) { return x.format === f; })[0];
        return { format: f, weight: row ? gramsText(row.weight_g) : '' };
      }),
      packages: (c.packages || []).map(function (p) {
        var max = {}; SHIP.FORMATS.forEach(function (f) { max[f] = (p.max || {})[f] ? String(p.max[f]) : ''; });
        return { id: p.id, name: p.name, max: max, weight: gramsText(p.weight_g) };
      }),
      zones: (c.zones || []).map(function (z) { return { id: z.id, name: z.name, countries: (z.countries || []).join(', ') }; }),
      rates: (c.rates || []).map(function (r) { return { key: shipKey(), zone: r.zone_id, pkg: r.package_id, upTo: kgText(r.max_weight_g), service: r.service, price: centsToText(r.price_cents) }; }),
      minimum: c.min_order_cents > 0 ? centsToText(c.min_order_cents).replace('.', ',') : ''
    };
  }
  function toConfig(f) {
    return {
      formats: f.formats.map(function (x) { return { format: x.format, weight_g: toInt(x.weight) }; }),
      packages: f.packages.map(function (p) {
        var max = {}; SHIP.FORMATS.forEach(function (fm) { var t = String(p.max[fm] || '').trim(); if (t) max[fm] = toInt(t); });
        return { id: p.id, name: p.name.trim(), weight_g: toInt(p.weight), max: max };
      }),
      zones: f.zones.map(function (z) { return { id: z.id, name: z.name.trim(), countries: codesOf(z.countries) }; }),
      rates: f.rates.map(function (r) { return { zone_id: r.zone, package_id: r.pkg, max_weight_g: kgToGrams(r.upTo), service: r.service.trim(), price_cents: textToCents(r.price) }; }),
      // empty = no minimum (null); "20" / "20,50" → cents (decision 0072)
      min_order_cents: textToCents(f.minimum)
    };
  }
  // "2 × 12", 1 × 7"" (also "2x12", "LP") → items for shipping.js
  function parseRecords(t) {
    var items = [], bad = [];
    String(t || '').split(/[,;+]/).forEach(function (part) {
      var s = part.trim(); if (!s) return;
      var m = /^(?:(\d+)\s*[×x*]\s*)?(7|10|12|LP)\s*(?:"|''|”|inch)?$/i.exec(s);
      if (!m) { bad.push(s); return; }
      var f = /lp/i.test(m[2]) ? 'LP' : m[2] + '"';
      for (var i = 0; i < (m[1] ? parseInt(m[1], 10) : 1); i++) items.push({ format: f, weight_g: null });
    });
    return { items: items, bad: bad };
  }

  function Shipping() {
    var fs = useState(null), form = fs[0], setForm = fs[1];
    var er = useState(null), error = er[0], setError = er[1];
    var vs = useState([]), problems = vs[0], setProblems = vs[1];
    var bs = useState(false), busy = bs[0], setBusy = bs[1];
    var cs = useState('DE'), checkCountry = cs[0], setCheckCountry = cs[1];
    var rs = useState('2 × 12", 1 × 7"'), checkRecords = rs[0], setCheckRecords = rs[1];

    useEffect(function () {
      sb.from('shipping_settings').select('config').maybeSingle().then(function (res) {
        if (res.error) setError(res.error.message);
        else if (!res.data) setError('no settings row');
        else setForm(toForm(res.data.config));
      });
    }, []);
    if (error) return h('p', { className: 'body-medium admin-status--error', role: 'alert' },
      'Could not load the shipping settings: ' + error + '. Is migration 0015 (shipping) applied?');
    if (!form) return h('p', { className: 'body-medium' }, 'Loading…');

    function set(list, i, key, value) {
      setForm(function (cur) {
        var next = Object.assign({}, cur);
        next[list] = cur[list].map(function (row, j) { if (j !== i) return row; var r = Object.assign({}, row); r[key] = value; return r; });
        return next;
      });
      setProblems([]);
    }
    function add(list, row) { setForm(function (cur) { var next = Object.assign({}, cur); next[list] = cur[list].concat([row]); return next; }); }
    function remove(list, i) { setForm(function (cur) { var next = Object.assign({}, cur); next[list] = cur[list].filter(function (_r, j) { return j !== i; }); return next; }); setProblems([]); }
    function field(list, i, key, label, extra) {
      return h(Z.Input, Object.assign({ size: 'compact', 'aria-label': label, value: form[list][i][key],
        onChange: function (e) { set(list, i, key, e.target.value); } }, extra || {}));
    }
    // a field inside an object of a row (package max per format)
    function subField(list, i, key, sub, label, extra) {
      return h(Z.Input, Object.assign({ size: 'compact', 'aria-label': label, value: form[list][i][key][sub],
        onChange: function (e) { var v = Object.assign({}, form[list][i][key]); v[sub] = e.target.value; set(list, i, key, v); } }, extra || {}));
    }
    function select(list, i, key, label, options) {
      return h(Z.Input, { variant: 'select', size: 'compact', 'aria-label': label, value: form[list][i][key],
        onChange: function (e) { set(list, i, key, e.target.value); } }, opts(options));
    }
    function removeButton(list, i, what) {
      return h(Z.Button, { hierarchy: 'secondary', size: 'small', 'aria-label': 'Remove ' + what, onClick: function () { remove(list, i); } }, 'Remove');
    }
    function table(id, cols, rows) {
      return h('div', { className: 'admin-table-wrap' },
        h('table', { id: id, className: 'admin-table admin-shipping__table body-small' },
          h('thead', null, h('tr', null, cols.map(function (c, i) { return h('th', { key: i, scope: 'col', className: c.className || '' }, c.label); }))),
          // each cell carries its column name: on mobile the rows stack and show it above the field (decision 0089)
          h('tbody', null, React.Children.map(rows, function (tr) {
            if (!tr || !tr.props) return tr;
            return React.cloneElement(tr, null, React.Children.map(tr.props.children, function (td, i) {
              return td && cols[i] && cols[i].label ? React.cloneElement(td, { 'data-label': cols[i].label }) : td;
            }));
          }))));
    }
    function section(key, heading, help, body, addLabel, onAdd) {
      var hid = 'shipping-' + key;
      return h('section', { className: 'admin-shipping__section', 'aria-labelledby': hid },
        h('h2', { id: hid, className: 'label-medium' }, heading),
        h('p', { className: 'body-small' }, help),
        body,
        addLabel ? h('div', null, h(Z.Button, { hierarchy: 'secondary', onClick: onAdd }, addLabel)) : null);
    }

    var pkgOptions = form.packages.map(function (p) { return [p.id, p.name || '(no name)']; });
    var zoneOptions = form.zones.map(function (z) { return [z.id, z.name || '(no name)']; });
    var config = toConfig(form);
    var used = function (key, id) { return form.rates.some(function (r) { return r[key] === id; }); };

    // Check an order: the same estimate as the bag
    var parsed = parseRecords(checkRecords);
    var est = parsed.bad.length ? null : SHIP.estimate(config, parsed.items, checkCountry);
    var countriesInZones = form.zones.reduce(function (all, z) { return all.concat(codesOf(z.countries)); }, []);
    var checkOptions = countriesInZones.concat(countriesInZones.indexOf(checkCountry) === -1 ? [checkCountry] : [])
      .map(function (c) { return [c, regionName(c)]; }).sort(function (a, b) { return a[1].localeCompare(b[1]); });
    var result;
    if (parsed.bad.length) result = 'Write the records as “2 × 12", 1 × 7"” (formats 7", 10", 12", LP): “' + parsed.bad[0] + '” is not clear.';
    else if (!est || est.status === 'empty') result = 'Add some records.';
    else if (est.status === 'not-configured') result = 'No rates yet: the shop says “Calculated at checkout”.';
    else if (est.status === 'not-served') result = regionName(checkCountry) + ' is in no zone: the bag says “We don’t ship to ' + regionName(checkCountry) + ' yet”.';
    else if (est.status === 'no-package') result = 'No package takes every format of this order: give a package a maximum for it.';
    else if (est.status === 'too-heavy') result = 'A parcel is heavier than every rate of ' + est.zone.name + ' for its package. The bag says it is too big for one parcel.';
    else {
      var weights = {}; config.formats.forEach(function (f) { weights[f.format] = f.weight_g; });
      var lines = est.parcels.map(function (pc) {
        var counts = {}; pc.items.forEach(function (it) { counts[it.format] = (counts[it.format] || 0) + 1; });
        var parts = Object.keys(counts).map(function (f) { return (counts[f] > 1 ? counts[f] + ' × ' : '') + weights[f] + ' g'; });
        return pc.package.name + ' · ' + parts.join(' + ') + ' + ' + pc.package.weight_g + ' g packaging = ' + pc.weight_g + ' g → ' +
          pc.rate.service + ' · ' + centsToText(pc.rate.price_cents).replace('.', ',') + '€';
      });
      result = lines.join('\n') + (est.parcels.length > 1 ? '\n' + est.parcels.length + ' parcels · ' + centsToText(est.price_cents).replace('.', ',') + '€' : '');
    }

    async function save() {
      var errs = SHIP.validate(config);
      if (errs.length) { setProblems(errs); return; }
      setBusy(true);
      var res = await sb.rpc('admin_save_shipping', { p_config: config });
      setBusy(false);
      if (res.error) { setProblems(['Nothing saved: ' + res.error.message]); return; }
      setProblems([]);
      toast('Shipping saved. The shop updates in about 2 minutes.');
    }

    return h('div', { className: 'admin-section admin-shipping' },
      h('h1', { className: 'label-extra-large' }, 'Shipping'),
      h('div', { className: 'admin-toolbar' },
        h('p', { className: 'body-small admin-shipping__intro' }, 'Prices come from the carriers’ price lists (DHL, Deutsche Post, Hermes): update them when the lists change. The bag shows an estimate for the chosen country; checkout recalculates it on the server.'),
        h(Z.Button, { hierarchy: 'secondary', 'aria-busy': busy || undefined, onClick: busy ? undefined : save }, 'Save')),
      problems.length ? h('ul', { className: 'admin-shipping__problems body-small admin-status--error', role: 'alert' },
        problems.map(function (p, i) { return h('li', { key: i }, p); })) : null,

      // Figma BACKEND → Shipping → `minimum order` (2247:3101, decision 0072): records only, shipping excluded
      section('minimum', 'Minimum order', 'The value of the records in the bag (shipping excluded) needed to check out. Empty = no minimum.',
        h('div', { className: 'admin-shipping__minimum' },
          h('label', { className: 'body-small', htmlFor: 'shipping-minimum-value' }, 'Minimum'),
          h(Z.Input, { size: 'compact', id: 'shipping-minimum-value', value: form.minimum, suffix: '€', inputMode: 'decimal',
            onChange: function (e) { var v = e.target.value; setForm(function (cur) { return Object.assign({}, cur, { minimum: v }); }); setProblems([]); } }))),

      section('formats', 'Formats', 'Weight of one record with its sleeve. A listing can override it (heavy pressings, box sets).',
        table('shipping-formats', [{ label: 'Format', className: 'admin-shipping__w-name' }, { label: 'Weight per record', className: 'admin-shipping__w-weight' }, { label: '' }],
          form.formats.map(function (f, i) {
            return h('tr', { key: f.format }, h('td', null, f.format),
              h('td', { className: 'admin-shipping__w-weight' }, field('formats', i, 'weight', 'Weight per record, ' + f.format + ', grams', { suffix: 'g', inputMode: 'numeric' })),
              h('td', null));
          }))),

      section('packaging', 'Packaging', 'How many records of each format fit in a package (empty = none). A mixed order shares the space: 2 LP out of 5 leave 60% for the rest. The bag picks the cheapest way to pack an order, in more parcels if it has to. The package weight is added to the records.',
        table('shipping-packages', [{ label: 'Package' }].concat(SHIP.FORMATS.map(function (f) { return { label: 'Max ' + f }; }),
          [{ label: 'Packaging weight' }, { label: '', className: 'admin-shipping__actions' }]),
          form.packages.map(function (p, i) {
            var name = p.name || 'package ' + (i + 1);
            return h('tr', { key: p.id },
              h('td', { className: 'admin-shipping__w-name' }, field('packages', i, 'name', 'Package ' + (i + 1) + ' name')),
              SHIP.FORMATS.map(function (f) {
                return h('td', { key: f, className: 'admin-shipping__w-count' }, subField('packages', i, 'max', f, name + ': maximum ' + f + ' records', { inputMode: 'numeric' }));
              }),
              h('td', { className: 'admin-shipping__w-weight' }, field('packages', i, 'weight', name + ': packaging weight, grams', { suffix: 'g', inputMode: 'numeric' })),
              h('td', { className: 'admin-shipping__actions' }, used('pkg', p.id) ? null : removeButton('packages', i, name)));
          })),
        'Add package', function () { add('packages', { id: shipKey(), name: '', max: { '7"': '', '10"': '', '12"': '', 'LP': '' }, weight: '' }); }),

      section('zones', 'Zones', 'Countries outside every zone can’t check out: the bag says “We don’t ship to … yet”. Countries as two-letter codes (DE, FR, GB…).',
        table('shipping-zones', [{ label: 'Zone', className: 'admin-shipping__w-name' }, { label: 'Countries' }, { label: '', className: 'admin-shipping__actions' }],
          form.zones.map(function (z, i) {
            var name = z.name || 'zone ' + (i + 1);
            var codes = codesOf(z.countries);
            return h('tr', { key: z.id },
              h('td', { className: 'admin-shipping__w-name' }, field('zones', i, 'name', 'Zone ' + (i + 1) + ' name')),
              h('td', null, field('zones', i, 'countries', name + ': countries, two-letter codes',
                { supportText: codes.length ? codes.map(regionName).join(', ') : 'No countries yet.' })),
              h('td', { className: 'admin-shipping__actions' }, used('zone', z.id) ? null : removeButton('zones', i, name)));
          })),
        'Add zone', function () { add('zones', { id: shipKey(), name: '', countries: '' }); }),

      section('rates', 'Rates', 'For each zone and package, the first row whose weight limit fits the order wins. An order heavier than every row can’t check out.',
        table('shipping-rates', [{ label: 'Zone', className: 'admin-shipping__w-select' }, { label: 'Package', className: 'admin-shipping__w-select' }, { label: 'Up to', className: 'admin-shipping__w-short' }, { label: 'Service (shown at checkout)' }, { label: 'Price', className: 'admin-shipping__w-short' }, { label: '', className: 'admin-shipping__actions' }],
          form.rates.map(function (r, i) {
            var n = 'Rate ' + (i + 1);
            return h('tr', { key: r.key },
              h('td', { className: 'admin-shipping__w-select' }, select('rates', i, 'zone', n + ': zone', zoneOptions)),
              h('td', { className: 'admin-shipping__w-select' }, select('rates', i, 'pkg', n + ': package', pkgOptions)),
              h('td', { className: 'admin-shipping__w-short' }, field('rates', i, 'upTo', n + ': up to, kilograms', { suffix: 'kg', inputMode: 'decimal' })),
              h('td', null, field('rates', i, 'service', n + ': service')),
              h('td', { className: 'admin-shipping__w-short' }, field('rates', i, 'price', n + ': price, euros', { suffix: '€', inputMode: 'decimal' })),
              h('td', { className: 'admin-shipping__actions' }, removeButton('rates', i, n)));
          })),
        'Add rate', function () {
          add('rates', { key: shipKey(), zone: (form.zones[0] || {}).id || '', pkg: (form.packages[form.packages.length - 1] || {}).id || '', upTo: '', service: '', price: '' });
        }),

      section('check', 'Check an order', 'Try a bag before saving: the same calculation the shop and checkout use.',
        h('div', null,
          h('div', { className: 'admin-shipping__check' },
            h(Z.Input, { variant: 'select', label: 'Country', value: checkCountry, onChange: function (e) { setCheckCountry(e.target.value); } }, opts(checkOptions)),
            h(Z.Input, { label: 'Records', value: checkRecords, onChange: function (e) { setCheckRecords(e.target.value); } })),
          h('p', { className: 'body-medium admin-shipping__result', role: 'status' }, result))));
  }

  // ── Memo ──────────────────────────────────────────────────────────────────
  /* Figma BACKEND → Memo (2296:9962, decision 0087): Gio's list of records to sell later, made for the phone.
     Add = Record (free text, or a Discogs release picked while typing) + optional Note. The list is public.memos
     (migration 0019, admin only), newest first. Create listing opens #new/memo/<id> (release fetched; the first
     save takes the item off the list). Remove deletes at once, toast with Undo (0049). */
  // a release as the picker shows it, from the discogs-lookup release answer (a pasted link)
  function releaseFromLookup(d) {
    var fmt = d.format || {}, desc = (fmt.descriptions || []).slice(0, 2).join(', ') || fmt.name || '';
    return { id: d.releaseId, title: (d.artist || 'Unknown') + ' – ' + (d.title || ''), thumb: '',
             meta: [d.label, d.catNo, d.year, d.country, desc].filter(function (x) { return x && String(x) !== '0'; }).join(' · '),
             uri: 'https://www.discogs.com/release/' + d.releaseId };
  }
  /* Record: the offer form's "Which record" (Figma `which record`, 0069) for the admin. ARIA 1.2 combobox: focus stays
     in the input, arrows move aria-activedescendant, Enter picks (or submits when nothing is highlighted), Escape
     closes. 3+ letters ask discogs-lookup { query } (debounced; a newer request wins); a pasted release link resolves. */
  function RecordField(props) {
    var id = props.id || 'memo-record', label = props.label || 'Record';
    var rs = useState(null), box = rs[0], setBox = rs[1];          // null | { results: [] } | { message: '' }
    var ac = useState(-1), active = ac[0], setActive = ac[1];
    var timer = useRef(null), seq = useRef(0);
    useEffect(function () { return function () { clearTimeout(timer.current); }; }, []);
    // releases found from a photo of the label (0090): shown as if typed; a newer photo or keystroke wins
    useEffect(function () {
      var f = props.found;
      if (!f) return;
      clearTimeout(timer.current); seq.current++;
      setBox(f.results.length ? { results: f.results } : { message: 'No match on Discogs for what the photo shows. Fix the text, or keep it as it is.' });
      setActive(-1);
    }, [props.found]);
    function close() { clearTimeout(timer.current); seq.current++; setBox(null); setActive(-1); }
    function show(next) { setBox(next); setActive(-1); }
    function onText(e) {
      var q = e.target.value;
      props.onText(q);
      clearTimeout(timer.current);
      var n = ++seq.current, t = q.trim();
      var link = t.match(/discogs\.com\/(?:[a-z-]+\/)?(release|master)\/(\d+)/i);
      if (link && link[1].toLowerCase() === 'master') { show({ message: 'That link is the master (every pressing). Search the title and pick your pressing, or paste its release link.' }); return; }
      if (!link && t.length < 3) { setBox(null); return; }
      timer.current = setTimeout(function () {
        var ask = link ? invoke('discogs-lookup', { releaseId: parseInt(link[2], 10) }).then(function (d) { return [releaseFromLookup(d)]; })
                       : invoke('discogs-lookup', { query: t }).then(function (d) { return d.results || []; });
        ask.then(function (list) {
          if (n !== seq.current) return;
          show(list.length ? { results: list } : { message: 'No match on Discogs. Keep it as you wrote it.' });
        }).catch(function (err) {
          if (n !== seq.current) return;
          show({ message: 'Discogs isn’t answering (' + err.message + '). Keep it as you wrote it.' });
        });
      }, link ? 0 : 350);
    }
    function pick(r) { close(); props.onRelease(r); }
    var results = box && box.results || [];
    function onKey(e) {
      if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); setActive((active + 1) % results.length); }
      else if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); setActive((active - 1 + results.length) % results.length); }
      else if (e.key === 'Enter' && active >= 0 && results[active]) { e.preventDefault(); pick(results[active]); }
      else if (e.key === 'Escape' && box) { e.preventDefault(); close(); }
    }
    if (props.release) {
      var r = props.release;
      return h('div', { className: 'admin-picker' },
        h('p', { className: 'body-small' }, label),
        h(Z.ChosenRelease, { title: r.title, meta: r.meta, thumb: r.thumb, href: r.uri, 'aria-live': 'polite',
          changeLabel: 'Change', onChange: function () { props.onRelease(null); setTimeout(function () { var el = document.getElementById(id); if (el) el.focus(); }, 0); } }));
    }
    return h('div', { className: 'admin-picker' },
      h(Z.Input, { id: id, label: label, value: props.value, error: props.error, placeholder: 'Artist – title, or search Discogs',
        autoComplete: 'off', role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': results.length ? 'true' : 'false',
        'aria-controls': id + '-list', 'aria-activedescendant': active >= 0 ? id + '-opt-' + active : undefined,
        onChange: onText, onKeyDown: onKey, onBlur: function () { setTimeout(close, 150); } }),
      box ? h(Z.ReleaseList, { className: 'admin-picker__list', listId: id + '-list', label: 'Releases on Discogs', message: box.message },
        results.map(function (r, i) {
          return h(Z.ReleaseOption, { key: r.id, id: id + '-opt-' + i, title: r.title, meta: r.meta, thumb: r.thumb, highlighted: i === active,
            onMouseDown: function (e) { e.preventDefault(); }, onClick: function () { pick(r); } });
        })) : null,
      h('p', { className: 'zz-visually-hidden', 'aria-live': 'polite' },
        box ? (box.message || results.length + (results.length === 1 ? ' release' : ' releases') + ' found. Use the arrow keys to choose.') : ''));
  }
  /* Photo of the label (Figma BACKEND → Memo → `memo photo`, state default | reading | read | not read; decision 0090).
     Opens the phone's back camera (a file picker on desktop). The photo is shrunk here (longest side 1280 px, JPEG),
     read by read-label (free vision model on Cloudflare Workers AI, nothing stored), then the fields go to
     discogs-lookup { fields }: barcode, then catalogue number, then artist + title. The words read land in Record. */
  var PHOTO_SIDE = 1280;
  function shrinkPhoto(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, PHOTO_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('this file is not a photo the browser can open')); };
      img.src = url;
    });
  }
  function PhotoField(props) {
    var ss = useState({ state: 'default', text: '' }), st = ss[0], setSt = ss[1];
    var ps = useState(0), progress = ps[0], setProgress = ps[1];
    var input = useRef(null), seq = useRef(0), tick = useRef(null);
    useEffect(function () { return function () { clearInterval(tick.current); }; }, []);
    /* the reader gives no progress: the bar is an estimate (0091). It eases towards a ceiling for the step
       (reading ~10 s → 85 %, Discogs → 97 %) and never stops moving or reaches 100 % until the answer is in. */
    function creep(ceiling, seconds) {
      clearInterval(tick.current);
      var k = 1 - Math.pow(0.05, 0.2 / seconds);   // ~95 % of the way to the ceiling after `seconds`
      tick.current = setInterval(function () {
        setProgress(function (p) { return p + Math.max((ceiling - p) * k, 0.05); });
      }, 200);
    }
    function stopAt(value) { clearInterval(tick.current); setProgress(value); }
    async function onFile(e) {
      var file = e.target.files && e.target.files[0];
      e.target.value = '';                       // the same photo can be taken again
      if (!file) return;
      var n = ++seq.current;
      setProgress(3);
      setSt({ state: 'reading', text: 'Reading the label…' });
      creep(85, 10);
      try {
        var image = await shrinkPhoto(file);
        var got = await invoke('read-label', { image: image });
        if (n !== seq.current) return;
        if (!got.read) { stopAt(0); setSt({ state: 'not read', text: 'Couldn’t read the label. Try closer, flat and with more light, or type it.' }); return; }
        var r = got.read;
        var said = [r.artist, r.title, [r.label, r.catno].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
        if (props.onText) props.onText(got.query);
        setSt({ state: 'reading', text: 'Looking for it on Discogs…' });
        creep(97, 3);
        var found = await invoke('discogs-lookup', { fields: r });
        if (n !== seq.current) return;
        stopAt(100);
        props.onFound({ results: found.results || [] });
        setSt({ state: 'read', text: 'Read from the photo: ' + said + '. ' + (props.pickHint || 'Pick your pressing in the list, or fix the text.') });
      } catch (err) {
        if (n !== seq.current) return;
        stopAt(0);
        setSt({ state: 'not read', text: 'Not read: ' + err.message });
      }
    }
    var reading = st.state === 'reading';
    // full: one full-width button (Memo); otherwise the button sits in a row after props.actions (Create, 0092)
    var button = h(Z.Button, { type: 'button', hierarchy: 'secondary', disabled: props.disabled, className: props.full ? 'admin-memo__photo-button' : undefined,
        'aria-busy': reading || undefined, onClick: function () { if (!reading) input.current.click(); } },
        st.state === 'read' || st.state === 'not read' ? 'Another photo' : 'Photo of the label');
    return h('div', { className: 'admin-memo__photo' },
      h('input', { ref: input, type: 'file', accept: 'image/*', capture: 'environment', className: 'zz-visually-hidden',
        tabIndex: -1, 'aria-hidden': 'true', onChange: onFile }),
      props.full ? button : h('div', { className: 'admin-photo-actions' }, props.actions, button),
      reading ? h(Z.ProgressBar, { value: progress, 'aria-label': 'Reading the photo' }) : null,
      h('p', { className: 'body-small admin-memo__photo-status', role: 'status' }, st.text));
  }
  function Memo() {
    var ls = useState(null), rows = ls[0], setRows = ls[1];
    var es = useState(null), loadError = es[0], setLoadError = es[1];
    var ts = useState(''), text = ts[0], setText = ts[1];
    var rl = useState(null), release = rl[0], setRelease = rl[1];
    var ns = useState(''), note = ns[0], setNote = ns[1];
    var er = useState(null), error = er[0], setError = er[1];
    var sv = useState(false), saving = sv[0], setSaving = sv[1];
    var ms = useState(null), message = ms[0], setMessage = ms[1];
    var fs = useState(null), found = fs[0], setFound = fs[1];       // releases from the last photo (0090)
    var pk = useState(0), photoKey = pk[0], setPhotoKey = pk[1];   // a new PhotoField after each add
    function load() {
      return sb.from('memos').select('*').order('created_at', { ascending: false }).then(function (res) {
        if (res.error) setLoadError(res.error.message); else { setLoadError(null); setRows(res.data); }
      });
    }
    useEffect(function () { load(); }, []);
    async function add(e) {
      e.preventDefault();
      if (saving) return;
      var title = release ? release.title : text.trim();
      if (!title) { setError('Write the record, or pick it on Discogs.'); return; }
      setError(null); setSaving(true); setMessage(null);
      var row = { title: title.slice(0, 300), note: note.trim() ? note.trim().slice(0, 1000) : null,
                  discogs_release_id: release ? release.id : null, discogs_meta: release && release.meta ? release.meta.slice(0, 300) : null };
      var res = await sb.from('memos').insert(row).select().single();
      setSaving(false);
      if (res.error) { setMessage({ error: true, text: 'Not added: ' + res.error.message }); return; }
      setRows(function (cur) { return [res.data].concat(cur || []); });
      setText(''); setRelease(null); setNote(''); setFound(null); setPhotoKey(photoKey + 1);
      setMessage({ error: false, text: 'Added: ' + res.data.title + '.' });
      var el = document.getElementById('memo-record'); if (el) el.focus();
    }
    async function remove(row) {
      setMessage(null);   // the last "Added:" line would outlive its row
      setRows(function (cur) { return cur.filter(function (r) { return r.id !== row.id; }); });
      var res = await sb.from('memos').delete().eq('id', row.id);
      if (res.error) { setMessage({ error: true, text: 'Not removed: ' + res.error.message }); load(); return; }
      toast('Removed: ' + row.title + '.', function () {
        sb.from('memos').insert(row).then(function (r) { if (r.error) setMessage({ error: true, text: 'Not restored: ' + r.error.message }); load(); });
      });
    }
    var count = rows ? rows.length : 0;
    return h('div', { className: 'admin-memo' },
      h('h1', { className: 'label-extra-large' }, 'Memo'),
      h('form', { className: 'admin-memo__add', onSubmit: add, noValidate: true },
        h(RecordField, { value: text, release: release, error: error,
          found: found, onText: function (v) { setText(v); if (error) setError(null); }, onRelease: function (r) { setRelease(r); if (r) setError(null); } }),
        h(PhotoField, { key: 'photo-' + photoKey, full: true,
          onText: function (v) { setRelease(null); setText(v); if (error) setError(null); }, onFound: setFound }),
        h(Z.Input, { id: 'memo-note', label: 'Note', optional: true, placeholder: 'Sleeve, condition, where it is…',
          value: note, onChange: function (e) { setNote(e.target.value); } }),
        h(Z.Button, { type: 'submit', className: 'admin-memo__submit', 'aria-busy': saving || undefined }, 'Add to list'),
        h('p', { className: 'body-small admin-status' + (message && message.error ? ' admin-status--error' : ''), role: 'status' }, message ? message.text : '')),
      loadError ? h('p', { className: 'body-medium admin-status--error', role: 'alert' }, 'List not loaded: ' + loadError)
        : !rows ? h('p', { className: 'body-small' }, 'Loading…')
        : h('div', { className: 'admin-memo__list' },
            h('p', { className: 'body-small admin-memo__count' }, count ? count + (count === 1 ? ' record' : ' records') : 'Nothing here yet. Add the records you want to sell later.'),
            count ? h('ul', { className: 'admin-memo__items', 'aria-label': 'Memo list' }, rows.map(function (r) {
              return h(Z.MemoItem, { key: r.id, title: r.title, meta: r.discogs_meta || undefined, note: r.note || undefined,
                href: r.discogs_release_id ? 'https://www.discogs.com/release/' + r.discogs_release_id : undefined,
                onCreate: function () { location.hash = '#new/memo/' + r.id; },
                onRemove: function () { remove(r); } });
            })) : null));
  }
  /* ── Bulk create (#bulk, Figma BACKEND → Bulk, decision 0107) ─────────────
     Gio drops many photos and samples named <record>_<role>: the page groups them per record, uploads them as Create
     does, reads each record's label photo with the AI of Memo (read-label → discogs-lookup { fields }), then shows an
     overview (BulkRecord rows) and a one-by-one review (Which record, Next / Skip). "Create N drafts" saves one draft per
     record through admin_save_listing; drafts may lack grading, format and price (migration 0026).
     Roles: photos _1 _2 … (gallery order; photo 1 is the one the AI reads, Gio 2026-11-17), any
     other word = a photo at the end; samples _a _b (sides) or _a1 _b2 (tracks) = the line with that Discogs position,
     anything else = an additional sample. A file without <record>_ is "not recognised": an image is read by the AI and
     joins the record with the same release; the rest waits for Gio to pick its record (or stays out).
     The batch lives in this page only: leaving it asks first. */
  var BULK_NAME = /^(.+)_([^_.]+?)(?:[ _-]?(?:copy|\(\d+\)))?\.([a-z0-9]+)$/i;
  var IMAGE_EXT = /^(jpe?g|png|webp|heic|heif|gif)$/i;
  function bulkKind(file) {
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (/^image\//.test(file.type) || IMAGE_EXT.test(ext)) return 'photo';
    if (file.type === 'audio/mpeg' || ext === 'mp3') return 'sample';
    return null;
  }
  // { prefix, role } or null; the prefix is the record (case and spaces ignored), the role says where the file goes
  function bulkParse(name) {
    var m = BULK_NAME.exec(String(name || '').trim());
    // a role is 1–2 digits, a word (label, cover) or a side with a track (a, b2): IMG_4471.jpg is a camera name, not ours
    if (!m || !/^(\d{1,2}|[a-z]+|[a-z]\d{1,2})$/i.test(m[2])) return null;
    return { prefix: m[1].trim(), key: m[1].trim().toLowerCase().replace(/\s+/g, '-'), role: m[2].toLowerCase() };
  }
  // at most n promises at a time (uploads, AI reads): the free tiers prefer a queue to a burst
  function limiter(n) {
    var running = 0, queue = [];
    function next() {
      if (running >= n || !queue.length) return;
      var job = queue.shift(); running++;
      job.fn().then(job.resolve, job.reject).then(function () { running--; next(); });
    }
    return function (fn) { return new Promise(function (resolve, reject) { queue.push({ fn: fn, resolve: resolve, reject: reject }); next(); }); };
  }
  var bulkUploads = limiter(3), bulkReads = limiter(1);
  // a record's files still going up, as one number for its ProgressBar (files waiting their turn count as 0); null = none
  function uploadProgressOf(r) {
    var up = r.photos.concat(r.samples).filter(function (x) { return x.uploading; });
    if (!up.length) return null;
    return Math.round(up.reduce(function (a, x) { return a + (x.progress || 0); }, 0) / up.length);
  }
  function photoSort(a, b) {
    function rank(p) { var n = parseInt(p.role, 10); return isNaN(n) ? 2e6 : n; }
    return rank(a) - rank(b) || a.name.localeCompare(b.name);
  }
  function filesText(r) {
    var photos = r.photos.length, sides = r.samples.map(function (x) { return /^[ab]\d*$/.test(x.role) ? x.role.toUpperCase() : 'extra'; });
    var up = r.photos.concat(r.samples).filter(function (x) { return x.uploading; }).length;
    var converting = r.samples.filter(function (x) { return x.uploading && x.phase === 'converting'; }).length;
    var failed = r.photos.concat(r.samples).filter(function (x) { return x.error; }).length;
    return [photos ? photos + (photos === 1 ? ' photo' : ' photos') : 'no photos',
            sides.length ? (sides.length === 1 ? 'sample ' : 'samples ') + sides.join(', ') : 'no samples',
            r.prefix, converting ? 'converting ' + converting + ' to 128 kbps' : null, up - converting ? 'uploading ' + (up - converting) : null, failed ? failed + ' not uploaded' : null].filter(Boolean).join(' · ');
  }
  function bulkWarnings(r) {
    var w = [], seen = {};
    r.samples.forEach(function (x) {
      if (!/^[ab]\d*$/.test(x.role)) return;
      if (seen[x.role]) w.push('Two samples for ' + x.role.toUpperCase() + ': ' + seen[x.role] + ' is used, ' + x.name + ' becomes an additional sample.');
      else seen[x.role] = x.name;
    });
    if (!r.photos.length) w.push('No photos: the draft has none.');
    r.photos.concat(r.samples).forEach(function (x) { if (x.error) w.push(x.name + ': ' + x.error); if (x.note) w.push(x.note); });
    return w.join(' ');
  }
  var BULK_STATUS = {
    matched: function (r) { return 'Found on Discogs from ' + r.readFrom + '. Confirm in review.'; },
    choose: function (r) { return r.found.results.length + ' pressings found on Discogs: pick yours in review.'; },
    'not found': function (r) { return (r.readText ? 'Read: ' + r.readText + '. Not found on Discogs' : 'Couldn’t read the label' + (r.readError ? ' (' + r.readError + ')' : '')) + ': search it in review, or skip.'; },
    confirmed: function () { return 'Confirmed.'; },
    skipped: function () { return 'Skipped: the draft is created without a Discogs release.'; }
  };
  // a sample's line once the release is known: exact Discogs position (A1), else the first track of that side (A)
  function sampleLine(role, positions) {
    if (!/^[ab]\d*$/.test(role)) return null;
    var R = role.toUpperCase(), i = positions.indexOf(R);
    if (i < 0 && R.length === 1) i = positions.findIndex(function (p) { return p.charAt(0) === R; });
    if (i < 0 && !positions.length) i = R === 'A' ? 0 : -1;     // no release: side A = line 1, the rest are additional
    return i >= 0 ? i + 1 : null;
  }

  function Bulk() {
    var mobile = useIsMobile();
    var rs = useState([]), records = rs[0], setRecords = rs[1];
    var us = useState([]), unsorted = us[0], setUnsorted = us[1];
    var vs = useState({ name: 'overview' }), view = vs[0], setView = vs[1];   // overview | review (at) | creating
    var ms = useState(null), message = ms[0], setMessage = ms[1];
    var recRef = useRef(records); recRef.current = records;
    var unsRef = useRef(unsorted); unsRef.current = unsorted;
    var busy = view.name === 'creating';

    // leaving with a batch not yet created asks first (the files are uploaded, the drafts are not)
    useEffect(function () {
      function warn(e) { if (recRef.current.length) { e.preventDefault(); e.returnValue = ''; } }
      window.addEventListener('beforeunload', warn);
      return function () { window.removeEventListener('beforeunload', warn); };
    }, []);

    function patchRecord(id, patch) {
      setRecords(function (cur) { return cur.map(function (r) { return r.id === id ? Object.assign({}, r, typeof patch === 'function' ? patch(r) : patch) : r; }); });
    }
    function patchFile(recId, fileId, patch) {
      patchRecord(recId, function (r) {
        function one(x) { return x.id === fileId ? Object.assign({}, x, patch) : x; }
        return { photos: r.photos.map(one), samples: r.samples.map(one) };
      });
    }
    function startUpload(recId, item) {
      bulkUploads(function () {
        return uploadFile(item.kind, item.file, function (st) { patchFile(recId, item.id, { phase: st.phase, progress: st.value }); },
          function (note) { patchFile(recId, item.id, { note: note }); });
      }).then(function (key) { patchFile(recId, item.id, { key: key, uploading: false }); })
        .catch(function (err) { patchFile(recId, item.id, { uploading: false, error: err.message }); });
    }
    function fileItem(file, kind, role) {
      return { id: nextId(), file: file, name: file.name, kind: kind, role: role, key: null, uploading: true, error: null,
               url: kind === 'photo' ? URL.createObjectURL(file) : null };
    }
    // the AI read of one photo: { read, query, results } (read null = not read)
    async function readPhoto(file) {
      var image = await shrinkPhoto(file);
      var got = await invoke('read-label', { image: image });
      if (!got.read) return { read: null, results: [] };
      var found = await invoke('discogs-lookup', { fields: got.read });
      return { read: got.read, query: got.query, results: found.results || [] };
    }
    function readRecord(id) {
      var r = recRef.current.filter(function (x) { return x.id === id; })[0];
      if (!r) return Promise.resolve();
      var photo = r.photos.slice().sort(photoSort)[0];   // photo 1 (Gio: the AI reads image 1, nothing else)
      if (!photo) { patchRecord(id, { state: 'not found', found: { results: [] } }); return Promise.resolve(); }
      patchRecord(id, { progress: 10 });
      return bulkReads(function () { patchRecord(id, { progress: 40 }); return readPhoto(photo.file); }).then(function (res) {
        var read = res.read, text = read ? [read.artist, read.title, [read.label, read.catno].filter(Boolean).join(' ')].filter(Boolean).join(' · ') : '';
        var n = res.results.length;
        patchRecord(id, { progress: 100, readFrom: photo.name, readText: text, query: res.query || '', found: { results: res.results },
          release: n === 1 ? res.results[0] : null, state: n === 1 ? 'matched' : n > 1 ? 'choose' : 'not found' });
      }).catch(function (err) {
        patchRecord(id, { progress: 100, readError: err.message, found: { results: [] }, state: 'not found' });
      });
    }
    // an image without <record>_ in its name: read it, and if its release is one of the batch's, it joins that record
    function readUnsorted(item) {
      return bulkReads(function () { return readPhoto(item.file); }).then(function (res) {
        var ids = res.results.map(function (x) { return x.id; });
        var home = recRef.current.filter(function (r) {
          return (r.release && ids.indexOf(r.release.id) >= 0) || (r.found && r.found.results.some(function (x) { return ids.indexOf(x.id) >= 0; }));
        })[0];
        if (home) assign(item, home.id, 'read');
        else setUnsorted(function (cur) { return cur.map(function (u) { return u.id === item.id ? Object.assign({}, u, { reading: false }) : u; }); });
      }).catch(function () {
        setUnsorted(function (cur) { return cur.map(function (u) { return u.id === item.id ? Object.assign({}, u, { reading: false }) : u; }); });
      });
    }
    // an unsorted file goes to a record (Gio's pick, or the AI's): a photo at the end of its gallery, a sample as additional
    function assign(item, recId, how) {
      setUnsorted(function (cur) { return cur.filter(function (u) { return u.id !== item.id; }); });
      var f = fileItem(item.file, item.kind, item.kind === 'photo' ? 'z' : 'x');
      f.assigned = how;
      patchRecord(recId, function (r) { return item.kind === 'photo' ? { photos: r.photos.concat([f]) } : { samples: r.samples.concat([f]) }; });
      startUpload(recId, f);
    }

    function onFiles(files) {
      setMessage(null);
      var byKey = {}, added = [], extra = [], loose = [], ignored = 0;
      recRef.current.forEach(function (r) { byKey[r.key] = { rec: r, old: true }; });
      files.forEach(function (file) {
        var kind = bulkKind(file);
        if (!kind) { ignored++; return; }
        var p = bulkParse(file.name);
        if (!p) { loose.push({ id: nextId(), file: file, name: file.name, kind: kind, reading: kind === 'photo', url: kind === 'photo' ? URL.createObjectURL(file) : null }); return; }
        var slot = byKey[p.key];
        if (!slot) {
          slot = byKey[p.key] = { old: false, rec: { id: nextId(), key: p.key, prefix: p.prefix, photos: [], samples: [], state: 'reading',
                                                      progress: 0, found: null, release: null, query: '' } };
          added.push(slot.rec);
        }
        var item = fileItem(file, kind, p.role);
        if (slot.old) extra.push({ recId: slot.rec.id, item: item });                 // a file for a record already here
        else (kind === 'photo' ? slot.rec.photos : slot.rec.samples).push(item);
      });
      setRecords(function (cur) {
        return cur.map(function (r) {
          var mine = extra.filter(function (x) { return x.recId === r.id; }).map(function (x) { return x.item; });
          if (!mine.length) return r;
          return Object.assign({}, r, { photos: r.photos.concat(mine.filter(function (x) { return x.kind === 'photo'; })),
                                        samples: r.samples.concat(mine.filter(function (x) { return x.kind === 'sample'; })) });
        }).concat(added);
      });
      added.forEach(function (r) { r.photos.concat(r.samples).forEach(function (it) { startUpload(r.id, it); }); });
      extra.forEach(function (x) { startUpload(x.recId, x.item); });
      setUnsorted(function (cur) { return cur.concat(loose); });
      if (ignored) setMessage({ error: true, text: ignored + (ignored === 1 ? ' file' : ' files') + ' left out: only photos (jpg, png, webp) and mp3 samples.' });
      // read the new records first, then the loose photos (they look for a record with the same release)
      setTimeout(function () {
        Promise.all(added.map(function (r) { return readRecord(r.id); })).then(function () {
          loose.filter(function (u) { return u.kind === 'photo'; }).forEach(readUnsorted);
        });
      }, 0);
    }

    function removeRecord(r) {
      setRecords(function (cur) { return cur.filter(function (x) { return x.id !== r.id; }); });
      toast('Removed: ' + (r.release ? r.release.title : r.prefix) + '.');
    }
    var co = useState(false), confirmOver = co[0], setConfirmOver = co[1];
    function startOver() { setConfirmOver(false); setRecords([]); setUnsorted([]); setMessage(null); setView({ name: 'overview' }); }

    // ── review one by one ──
    function reviewIndexFrom(i) {
      var list = recRef.current;
      for (var k = i; k < list.length; k++) if (['matched', 'choose', 'not found'].indexOf(list[k].state) >= 0) return k;
      return -1;
    }
    function openReview(at) { setMessage(null); setView({ name: 'review', at: at }); window.scrollTo(0, 0); }
    // Next / Skip go to the next record still to review; after the last one, back to the overview
    function advance(at) {
      var n = reviewIndexFrom(at + 1);
      setView(n < 0 ? { name: 'overview' } : { name: 'review', at: n }); window.scrollTo(0, 0);
    }

    // ── create the drafts ──
    async function createDrafts() {
      var list = recRef.current;
      if (!list.length) return;
      if (list.some(function (r) { return r.state === 'reading'; })) { setMessage({ error: true, text: 'Wait until every label is read.' }); return; }
      if (list.some(function (r) { return r.photos.concat(r.samples).some(function (x) { return x.uploading; }); })) { setMessage({ error: true, text: 'Wait for the uploads to finish.' }); return; }
      setView({ name: 'creating' }); setMessage({ error: false, text: 'Creating drafts…' });
      var entities = null;
      try { entities = await loadEntities(); } catch (e) { /* the drafts bind entities by name on save */ }
      var done = 0, failed = [];
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        setMessage({ error: false, text: 'Creating draft ' + (i + 1) + ' of ' + list.length + '…' });
        try {
          var f = emptyForm(), positions = [];
          var release = r.state === 'skipped' ? null : r.release;
          if (release) {
            var d = await invoke('discogs-lookup', { releaseId: release.id });
            Object.assign(f, patchFromDiscogs(f, d, entities).patch);
            positions = (d.tracks || []).filter(function (t) { return t.title; }).map(function (t) { return String(t.position || '').toUpperCase(); });
          } else {
            f.lines = [newLine({ title: r.prefix })];
          }
          f.images = r.photos.filter(function (x) { return x.key; }).slice().sort(photoSort).map(function (x) { return { id: x.id, key: x.key, name: x.name }; });
          var used = {};
          f.samples = r.samples.filter(function (x) { return x.key; }).map(function (x) {
            var line = sampleLine(x.role, positions);
            if (line && (used[line] || line > f.lines.length)) line = null;   // a second sample of a side: additional
            if (line) used[line] = true;
            return { id: x.id, key: x.key, name: x.name, line: line };
          });
          var res = await sb.rpc('admin_save_listing', { payload: payloadOf(f, 'draft') });
          if (res.error) throw new Error(res.error.message);
          done++;
          patchRecord(r.id, { created: true });
        } catch (err) {
          failed.push({ id: r.id, text: err.message });
        }
      }
      // the created ones leave the batch; the failed ones stay with the reason
      setRecords(function (cur) {
        var why = {}; failed.forEach(function (f) { why[f.id] = f.text; });
        return cur.filter(function (x) { return why[x.id]; }).map(function (x) { return Object.assign({}, x, { saveError: why[x.id] }); });
      });
      setView({ name: 'overview' });
      if (!failed.length) {
        setUnsorted([]);
        setMessage(null);
        toast(plural(done, 'draft') + ' created. Fill in grading and price to publish.');
        location.hash = '#';
        return;
      }
      setMessage({ error: true, text: plural(done, 'draft') + ' created; ' + plural(failed.length, 'record') + ' not saved: see below.' });
    }

    // ── render ──
    var statusLine = h('p', { className: 'body-small admin-status' + (message && message.error ? ' admin-status--error' : ''), role: 'status' }, message ? message.text : '');
    var help = h(Z.BulkHelp, { heading: 'Name the files record_role, one prefix per record:',
      lines: ['Photos: _1, _2, _3… in gallery order. Photo _1 is read to find the record on Discogs: make it the label.',
              'Samples: _a and _b for the A and B side. On an LP _a1, _a2, _b1… Anything else becomes an additional sample.'],
      example: 'e.g. nooks-hero_1.jpg · nooks-hero_2.jpg · nooks-hero_a.mp3 · nooks-hero_b.mp3' });
    var drop = h(Z.DropZone, { label: records.length ? 'Add more files' : 'Browse photos and samples', multiple: true,
      accept: 'image/jpeg,image/png,image/webp,image/heic,audio/mpeg,.mp3', disabled: busy, onFiles: onFiles });

    if (view.name === 'review' && records[view.at]) {
      var r = records[view.at], at = view.at;
      var photo = r.photos.slice().sort(photoSort)[0];   // photo 1 (Gio: the AI reads image 1, nothing else)
      function next() {
        var cur = recRef.current[at];
        if (!cur.release) { setMessage({ error: true, text: 'Pick a release, or Skip.' }); return; }
        setMessage(null); patchRecord(cur.id, { state: 'confirmed' }); advance(at);
      }
      function skip() { setMessage(null); patchRecord(r.id, { state: 'skipped', release: null }); advance(at); }
      var nextBtn = h(Z.Button, { key: 'next', hierarchy: 'primary', onClick: next }, 'Next');
      var skipBtn = h(Z.Button, { key: 'skip', hierarchy: 'secondary', onClick: skip }, 'Skip');
      return h('div', { className: 'admin-bulk-page admin-bulk-page--review' },
        h('div', { className: 'admin-bulk-page__head' },
          h('p', { className: 'body-small admin-memo__count' }, 'Record ' + (at + 1) + ' of ' + records.length + ' · ' + r.prefix),
          h(Z.Button, { hierarchy: 'secondary', size: 'small', onClick: function () { setMessage(null); setView({ name: 'overview' }); } }, 'Back to overview')),
        photo ? h('img', { className: 'admin-bulk-page__photo', src: photo.url, alt: 'Photo ' + photo.name }) : null,
        h('p', { className: 'body-small' }, filesText(r)),
        h(RecordField, { key: r.id, id: 'bulk-record', label: 'Which record', value: r.query || '', release: r.release, found: r.found,
          onText: function (v) { patchRecord(r.id, { query: v }); },
          onRelease: function (rel) { patchRecord(r.id, { release: rel }); if (rel) setMessage(null); } }),
        mobile ? h(Z.ActionBar, { status: statusLine }, nextBtn, skipBtn)
          : h('div', { className: 'admin-bulk-page__actions' }, nextBtn, skipBtn, statusLine));
    }

    var reading = records.filter(function (x) { return x.state === 'reading'; }).length;
    var toReview = records.filter(function (x) { return ['matched', 'choose', 'not found'].indexOf(x.state) >= 0; }).length;
    var nFiles = records.reduce(function (n, x) { return n + x.photos.length + x.samples.length; }, 0) + unsorted.length;
    var summary = records.length ? [plural(records.length, 'record'), plural(nFiles, 'file'), reading ? reading + ' reading' : null,
      toReview ? toReview + ' to review' : null, unsorted.length ? plural(unsorted.length, 'file') + ' not recognised' : null].filter(Boolean).join(' · ') : '';
    var createBtn = h(Z.Button, { key: 'create', hierarchy: toReview ? 'secondary' : 'primary', 'aria-busy': busy || undefined, disabled: !records.length || reading > 0,
      onClick: busy ? undefined : createDrafts }, mobile && toReview ? 'Create drafts' : 'Create ' + plural(records.length, 'draft'));   // the count is in the summary line
    var reviewBtn = toReview ? h(Z.Button, { key: 'review', hierarchy: 'primary', disabled: busy || reading > 0, onClick: function () { openReview(reviewIndexFrom(0)); } }, 'Review') : null;
    var options = records.map(function (x) { return [x.id, x.release ? x.release.title : x.prefix]; });

    return h('div', { className: 'admin-bulk-page' },
      h('h1', { className: 'label-extra-large' }, 'Bulk create'),
      records.length ? null : help,
      drop,
      summary ? h('p', { className: 'body-small admin-memo__count', 'aria-live': 'polite' }, summary) : null,
      unsorted.length ? h('div', { className: 'admin-bulk-page__unsorted' }, unsorted.map(function (u) {
        return h('div', { key: u.id, className: 'admin-bulk-page__file' },
          h(Z.FileItem, { name: u.name, position: '', image: u.kind === 'photo' ? { src: u.url, alt: '' } : undefined,
            onRemove: function () { setUnsorted(function (cur) { return cur.filter(function (x) { return x.id !== u.id; }); }); }, removeLabel: 'Leave out ' + u.name }),
          h(Z.Input, { variant: 'select', id: 'unsorted-' + u.id, label: 'Record', value: '',
            supportText: u.reading ? 'Reading the photo…' : 'Name not recognised. Pick the record it belongs to.',
            disabled: busy || !records.length, placeholder: 'Leave out',
            onChange: function (e) { if (e.target.value) assign(u, e.target.value, 'picked'); } }, opts(options)));
      })) : null,
      records.length ? h('ul', { className: 'admin-memo__items', 'aria-label': 'Records found' }, records.map(function (x, i) {
        var warn = [bulkWarnings(x), x.saveError ? 'Not saved: ' + x.saveError : ''].filter(Boolean).join(' ');
        return h(Z.BulkRecord, { key: x.id, state: x.state, progress: x.progress, uploadProgress: uploadProgressOf(x),
          title: x.release && x.state !== 'skipped' ? x.release.title : x.prefix,
          meta: x.release && x.state !== 'skipped' ? x.release.meta : undefined,
          files: filesText(x),
          status: x.state === 'reading' ? (x.progress < 40 ? 'Waiting to read the label…' : 'Reading the label…') : BULK_STATUS[x.state](x),
          warning: warn || undefined,
          onReview: busy ? undefined : function () { openReview(i); },
          onRemove: busy ? undefined : function () { removeRecord(x); } });
      })) : null,
      records.length ? (mobile ? h(Z.ActionBar, { status: statusLine }, reviewBtn || createBtn, reviewBtn ? createBtn : null)
        : h('div', { className: 'admin-bulk-page__actions' }, reviewBtn, createBtn,
            h(Z.Button, { key: 'over', hierarchy: 'secondary', disabled: busy, onClick: function () { setConfirmOver(true); } }, 'Start over'), statusLine))
        : statusLine,
      h(Z.Dialog, { open: confirmOver, title: 'Start over?', confirmLabel: 'Start over',
        onCancel: function () { setConfirmOver(false); }, onConfirm: startOver },
        h('p', null, 'The ' + plural(records.length, 'record') + ' of this batch are left out: no draft is created (the files already uploaded stay in storage, unused).')));
  }
  // #new/memo/<id>: the listing form, started from a memo
  function FromMemoLoader(props) {
    var st = useState(null), item = st[0], setItem = st[1];
    var er = useState(null), error = er[0], setError = er[1];
    useEffect(function () {
      sb.from('memos').select('*').eq('id', props.id).single()
        .then(function (res) { if (res.error) setError(res.error.message); else setItem(res.data); });
    }, [props.id]);
    if (error) return h('p', { className: 'body-medium admin-status--error', role: 'alert' }, 'Could not open this memo: ' + error);
    if (!item) return h('p', { className: 'body-medium' }, 'Loading…');
    var initial = emptyForm();
    if (item.discogs_release_id) initial.discogs = String(item.discogs_release_id);
    return h(ListingForm, { initial: initial, fromMemo: { id: item.id, title: item.title, note: item.note, discogs: item.discogs_release_id } });
  }

  // ── App ───────────────────────────────────────────────────────────────────
  // [hash, visit]: visit changes on every navigation, so "Create listing" always opens an empty form
  function useHash() {
    var st = useState({ hash: location.hash, visit: 0 }), v = st[0], setV = st[1];
    useEffect(function () {
      function on() { setV(function (cur) { return { hash: location.hash, visit: cur.visit + 1 }; }); }
      window.addEventListener('hashchange', on);
      return function () { window.removeEventListener('hashchange', on); };
    }, []);
    return v;
  }
  function App() {
    var ss = useState(undefined), session = ss[0], setSession = ss[1];
    var as = useState(null), isAdmin = as[0], setIsAdmin = as[1];
    var route = useHash(), hash = route.hash;
    useEffect(function () {
      sb.auth.getSession().then(function (r) { setSession(r.data.session); });
      var sub = sb.auth.onAuthStateChange(function (_e, s) { setSession(s); });
      return function () { sub.data.subscription.unsubscribe(); };
    }, []);
    useEffect(function () {
      if (!session) { setIsAdmin(null); return; }
      sb.rpc('is_admin').then(function (r) { setIsAdmin(r.data === true); });
      if (/access_token=/.test(location.hash)) history.replaceState(null, '', location.pathname);
    }, [session && session.user.id]);

    var body;
    if (session === undefined) body = h('p', { className: 'body-medium' }, 'Loading…');
    else if (!session) body = h(SignIn);
    else if (isAdmin === null) body = h('p', { className: 'body-medium' }, 'Checking access…');
    else if (!isAdmin) body = h('p', { className: 'body-medium', role: 'alert' }, 'This account has no admin access.');
    else if (hash === '#new') body = h(ListingForm, { key: 'new-' + route.visit, initial: emptyForm() });
    else if (/^#edit-/.test(hash)) body = h(EditLoader, { key: hash + route.visit, id: hash.slice(6) });
    else if (/^#attributes\/[a-z]+\/[^/]+$/.test(hash)) body = h(AttributeForm, { key: hash + route.visit, kind: hash.split('/')[1], id: hash.split('/')[2] });
    else if (/^#attributes/.test(hash)) body = h(Attributes, { key: 'attributes', kind: hash.split('/')[1] || 'artist' });
    else if (hash === '#shipping') body = h(Shipping, { key: 'shipping-' + route.visit });
    else if (hash === '#settings') body = h(Settings, { key: 'settings-' + route.visit });
    else if (hash === '#content') body = h(Content, { key: 'content-' + route.visit });
    else if (/^#content\/[a-z_.]+$/.test(hash)) body = h(ContentEditor, { key: hash + route.visit, blockKey: hash.slice(9) });
    else if (hash === '#orders') body = h(Orders, { key: 'orders-' + route.visit });
    else if (/^#orders\/[^/]+$/.test(hash)) body = h(OrderDetail, { key: hash + route.visit, id: hash.split('/')[1] });
    else if (hash === '#memo') body = h(Memo, { key: 'memo-' + route.visit });
    else if (hash === '#bulk') body = h(Bulk, { key: 'bulk' });
    else if (/^#new\/memo\/[^/]+$/.test(hash)) body = h(FromMemoLoader, { key: hash + route.visit, id: hash.split('/')[2] });
    else body = h(Listings, { key: 'list-' + route.visit });

    return h('div', { className: 'admin' },
      session ? h(Nav, { hash: hash, email: session.user.email }) : null,
      body);
  }

  /* Admin navigation (Figma page `admin`, decision 0089): AdminBar (desktop buttons / mobile Menu · title · Create)
     + the mobile menu, a full-screen native modal <dialog> with a MenuLayer, like the shop's (0060): Esc, × or
     following a link closes it, focus goes back to the Menu button. */
  var SECTIONS = [['listings', 'Listings', '#'], ['orders', 'Orders', '#orders'], ['memo', 'Memo', '#memo'], ['bulk', 'Bulk', '#bulk'], ['attributes', 'Attributes', '#attributes'], ['shipping', 'Shipping', '#shipping'], ['settings', 'Settings', '#settings'], ['content', 'Content', '#content']];
  function sectionOf(hash) {
    if (/^#orders/.test(hash)) return 'orders';
    if (/^#memo/.test(hash)) return 'memo';
    if (hash === '#bulk') return 'bulk';
    if (/^#attributes/.test(hash)) return 'attributes';
    if (hash === '#shipping') return 'shipping';
    if (hash === '#settings') return 'settings';
    if (/^#content/.test(hash)) return 'content';
    if (/^#new/.test(hash)) return null;   // Create: no section is current (the Create button is the way in)
    return 'listings';                        // list and #edit-<id>
  }
  function Nav(props) {
    var dialogRef = useRef(null), menuBtn = useRef(null);
    var op = useState(false), open = op[0], setOpen = op[1];
    var current = sectionOf(props.hash);
    function signOut() { sb.auth.signOut(); }
    function openMenu() { var d = dialogRef.current; if (d && d.showModal) { d.showModal(); setOpen(true); d.focus(); } }
    function closeMenu() { var d = dialogRef.current; if (d && d.open) d.close(); }
    useEffect(function () {
      var d = dialogRef.current; if (!d) return;
      function onClose() { setOpen(false); var b = document.querySelector('.zz-admin-bar__menu'); if (b) b.focus(); }
      d.addEventListener('close', onClose);
      return function () { d.removeEventListener('close', onClose); };
    }, []);
    useEffect(function () { closeMenu(); }, [props.hash]);   // following a link (hash change) closes the menu
    return h(React.Fragment, null,
      h(Z.AdminBar, {
        items: SECTIONS.map(function (x) { return { href: x[2], label: x[1], current: x[0] === current }; }),
        title: document.title || 'Store admin', createHref: '#new', email: props.email, onSignOut: signOut,
        onMenuClick: openMenu, menuProps: { 'aria-expanded': open ? 'true' : 'false', 'aria-controls': 'admin-menu', 'aria-haspopup': 'dialog' }
      }),
      h('dialog', { id: 'admin-menu', className: 'admin-menu', 'aria-label': 'Menu', tabIndex: -1, ref: dialogRef,
        onClick: function (e) { if (e.target.closest && e.target.closest('a[href]')) closeMenu(); } },
        h(Z.MenuLayer, { title: 'Menu', closeLabel: 'Close menu', onClose: closeMenu },
          h(Z.MenuGroup, null, SECTIONS.map(function (x) { return h(Z.MenuItem, { key: x[0], href: x[2], label: x[1], current: x[0] === current }); })),
          h(Z.MenuGroup, null, h(Z.MenuItem, { label: 'Sign out', detail: props.email, onClick: signOut })))));
  }

  window.ReactDOM.createRoot(document.getElementById('root')).render(h(App));
  // the toast region (decision 0049): its own root, rendered once and never again, so toast.js owns what goes in it
  window.ReactDOM.createRoot(document.getElementById('toasts')).render(h(Z.ToastRegion));
})();
