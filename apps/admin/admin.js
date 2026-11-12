/* apps/admin/admin.js — the admin single-page app (React via createElement, no build step).
   Screens: sign-in (email link) · listings (Figma BACKEND → Listings: bulk actions, archive, delete) · create / edit listing (Figma BACKEND → Create)
   · attributes: artists, labels, genres, tags (Figma BACKEND → Attributes) · shipping (Figma BACKEND → Shipping).
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
  // images: resized in the browser to webp, long side 1600 (backend.md → Storage)
  function toWebp(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('Could not convert ' + file.name + '.')); }, 'image/webp', 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error(file.name + ' is not a readable image.')); };
      img.src = url;
    });
  }
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
  async function upload(kind, blob) {
    var signed = await invoke('sign-upload', { kind: kind, contentType: blob.type, size: blob.size });
    var put;
    try { put = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob }); }
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
    f.labelSpelled = !!le && differs(r.label, le.name); f.labelCredit = f.labelSpelled ? r.label : ''; f.country = r.country || ''; f.year = r.year ? String(r.year) : ''; f.format = r.format || '';
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
  function validate(f) {
    var e = {};
    if (!f.lines[0].artists.length) e['artist-0'] = 'Pick or create the artist.';
    f.lines.forEach(function (l, i) { if (!l.title.trim()) e['title-' + i] = 'Enter the title.'; });
    if (!f.format) e.format = 'Choose a format.';
    if (!f.condition) e.condition = 'Choose the condition of side A.';
    var cents = textToCents(f.price);
    if (f.section === 'sale' && cents === null) e.price = 'Enter a price.';
    else if (Number.isNaN(cents)) e.price = 'Use a number, e.g. 12 or 12.50.';
    if (f.year && !/^(19|20)\d\d$/.test(f.year.trim())) e.year = 'Use four digits, e.g. 1983.';
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
        label_id: f.label.length ? f.label[0].id : null, label_discogs_id: f.label.length ? f.label[0].discogsId || null : null, cat_no: f.catNo, year: f.year.trim(), country: f.country, format: f.format,
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

  // ── audio preview (one at a time) ─────────────────────────────────────────
  var audio = new Audio();

  // ── Create / edit listing ─────────────────────────────────────────────────
  function ListingForm(props) {
    var st = useState(props.initial), f = st[0], setF = st[1];
    var er = useState({}), errors = er[0], setErrors = er[1];
    var ms = useState(null), message = ms[0], setMessage = ms[1];
    var sv = useState(false), saving = sv[0], setSaving = sv[1];
    var pl = useState(null), playing = pl[0], setPlaying = pl[1];
    var fRef = useRef(f); fRef.current = f;
    var fd = useState(false), fetching = fd[0], setFetching = fd[1];
    var en = useState(null), entities = en[0], setEntities = en[1];
    useEffect(function () {
      loadEntities().then(setEntities).catch(function (err) { setMessage({ error: true, text: 'Suggestions not loaded: ' + err.message }); });
    }, []);

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
        if (playing === id) { audio.pause(); setPlaying(null); }
        set(function (cur) { var p = {}; p[listName] = cur[listName].filter(function (x) { return x.id !== id; }); return p; });
      };
    }
    function patchItem(listName, id, patch) {
      set(function (cur) { var p = {}; p[listName] = cur[listName].map(function (x) { return x.id === id ? Object.assign({}, x, patch) : x; }); return p; });
    }
    function togglePlay(s) {
      if (!s.url) return;
      if (playing === s.id) { audio.pause(); setPlaying(null); return; }
      audio.src = s.url; audio.play().catch(function () {}); setPlaying(s.id);
      audio.onended = function () { setPlaying(null); };
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
          var item = { id: nextId(), key: null, name: file.name, url: URL.createObjectURL(file), uploading: true, line: line === undefined ? null : line };
          var listName = kind === 'photo' ? 'images' : 'samples';
          set(function (cur) { var p = {}; p[listName] = cur[listName].concat([item]); return p; });
          (kind === 'photo' ? toWebp(file) : Promise.resolve(file))
            .then(function (blob) { return upload(kind, blob); })
            .then(function (key) { patchItem(listName, item.id, { key: key, uploading: false }); })
            .catch(function (err) {
              set(function (cur) { var p = {}; p[listName] = cur[listName].filter(function (x) { return x.id !== item.id; }); return p; });
              setMessage({ error: true, text: file.name + ': ' + err.message });
            });
        });
      };
    }
    async function save(status) {
      var cur = fRef.current, e = validate(cur);
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
      setMessage({ error: false, text: d.status === 'available'
        ? 'Published · SKU ' + d.sku + '. The shop updates in about 2 minutes.'
        : 'Saved as draft · SKU ' + d.sku + '.' });
      if (!cur.listingId) history.replaceState(null, '', '#edit-' + d.listing_id);
    }

    // Fetch Discogs: reads the release in "Discogs match" and fills the release fields
    async function fetchDiscogs() {
      if (fetching) return;
      var id = discogsId(fRef.current.discogs);
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

    function fileItem(listName, x, extra, children) {
      return h(Z.FileItem, Object.assign({
        key: x.id, name: x.uploading ? x.name + ' · uploading…' : x.name,
        onRemove: removeFrom(listName, x.id)
      }, extra), children);
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
    function overviewSampleItem(s) {
      return fileItem('samples', s, { playing: playing === s.id, onTogglePlay: function () { togglePlay(s); } },
        h(Z.Input, { id: 'sample-title-' + s.id, 'aria-label': 'Title of ' + s.name, value: sampleTitleOf(s),
          onChange: function (e) { patchItem('samples', s.id, { title: e.target.value }); } }));
    }
    // samples of a line keep the overview order; reorder happens in the overview
    function lineSamples(i) { return f.samples.filter(function (s) { return s.line === i + 1; }); }

    var isNew = !f.listingId;
    var locked = f.status === 'reserved' || f.status === 'sold' || f.status === 'traded' || f.status === 'archived';

    var main = h('div', { className: 'admin-main' },
      h('h1', { className: 'label-extra-large' }, isNew ? 'Create listing' : 'Edit listing'),

      h('section', { className: 'admin-section' },
        h(Z.Input, Object.assign({ id: 'custom-title', label: 'Custom title', optional: true,
          supportText: 'Replaces "Artist - Title" in the shop.' }, bind('customTitle'))),
        h(Z.Input, Object.assign({ id: 'discogs', label: 'Discogs match', optional: true, variant: 'search',
          placeholder: 'Release URL or number', supportText: errors.discogs ? undefined : 'Paste the release link, then Fetch Discogs.' }, bind('discogs'))),
        // Figma 2104:20728: secondary button right under Discogs match (gap 16)
        h('div', null, h(Z.Button, { hierarchy: 'secondary', disabled: locked, 'aria-busy': fetching || undefined, onClick: fetchDiscogs }, 'Fetch Discogs'))),
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
          h(Z.Input, Object.assign({ className: 'span-2', id: 'year', label: 'Year', optional: true, inputMode: 'numeric', maxLength: 4 }, bind('year'))),
          // Figma 2104:21454: a pre-release ("blank") of the same label → the shop shows "Pre" next to the label
          h(Z.Checkbox, { className: 'span-4 row-start', label: 'Pre-release', checked: f.preRelease,
            onChange: function (e) { set({ preRelease: e.target.checked }); } }),
          h(Z.Checkbox, { className: 'span-4 row-start', label: 'Different spelling', checked: f.labelSpelled,
            onChange: function (e) { set({ labelSpelled: e.target.checked }); } }),
          f.labelSpelled ? h(Z.Input, Object.assign({ className: 'span-4', id: 'label-credit', label: 'Label spelled on record' }, bind('labelCredit'))) : null),
        h('div', { className: 'admin-row' },
          h(Z.Input, Object.assign({ className: 'span-2', id: 'format', label: 'Format', variant: 'select', placeholder: '' }, bind('format')), opts(FORMATS)),
          h(Z.Input, Object.assign({ className: 'span-2', id: 'section', label: 'Sale type', variant: 'select' }, bind('section')), opts([['sale', 'For sale'], ['trade', 'For trade']])),
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
    var side = h('aside', { className: 'admin-side' },
      h(Z.ActionPanel, null,
        h(Z.Button, { hierarchy: 'primary', disabled: saving || locked, onClick: function () { save('available'); } }, f.status === 'available' ? 'Update' : 'Publish now'),
        h(Z.Button, { hierarchy: 'secondary', disabled: saving || locked || f.status === 'available', onClick: function () { save('draft'); } }, 'Save draft'),
        h(Z.Button, { hierarchy: 'secondary', href: shopUrl || undefined, disabled: !shopUrl, target: '_blank', rel: 'noopener' }, 'Preview')),
      h('p', { className: 'admin-status body-small' + (message && message.error ? ' admin-status--error' : ''), role: 'status' }, message ? message.text : ''),
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
        }));
    }

    return h('div', { className: 'admin-page' }, main, side);
  }

  // ── Listings ──────────────────────────────────────────────────────────────
  function nameOf(row) {
    if (row.custom_title) return row.custom_title;
    var lines = ((row.release || {}).lines || []).slice().sort(function (a, b) { return a.position - b.position; });
    if (!lines.length) return row.slug;
    var multi = lines.some(function (l, i) { return i > 0 && l.artist; });
    return multi ? lines.map(function (l) { return (l.artist || lines[0].artist) + ' - ' + l.title; }).join(' / ')
                 : lines[0].artist + ' - ' + lines.map(function (l) { return l.title; }).join(' / ');
  }
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
    publish:   { ok: function (r) { return r.eff === 'draft'; },
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
    var st = useState(null), rows = st[0], setRows = st[1];
    var er = useState(null), error = er[0], setError = er[1];
    var tb = useState('all'), tab = tb[0], setTab = tb[1];
    var se = useState([]), selected = se[0], setSelected = se[1];
    var ms = useState(null), message = ms[0], setMessage = ms[1];
    var bs = useState(false), busy = bs[0], setBusy = bs[1];
    var cf = useState(null), confirm = cf[0], setConfirm = cf[1];
    var focusAfter = useRef(null);

    function load() {
      return sb.from('listings').select('id,sku,slug,status,reserved_until,published_at,section,price_cents,custom_title,created_at,orders:order_items(count),release:releases(lines:release_lines(position,artist,title))')
        .order('sku', { ascending: false })
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
        setMessage({ error: true, text: 'None of the selected listings can be ' + DONE_VERB[action] + ' from ' + (picked.length === 1 ? 'its' : 'their') + ' status.' });
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
        (confirm.action === 'delete' ? ' (an order or a checkout holds ' + (rest === 1 ? 'it' : 'them') + ')' : ' from ' + (rest === 1 ? 'its' : 'their') + ' status') + ' and stays as it is.';
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
      bar,
      h('div', { className: 'admin-table-wrap' },
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
              h('td', null, STATUS_LABEL[r.eff] || r.status),
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
      bar,
      h('div', { className: 'admin-table-wrap' },
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
            .in('id', e.listing_ids).order('sku', { ascending: false })
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
          return h('li', { key: r.id }, h('a', { href: '#edit-' + r.id }, [String(r.sku).padStart(4, '0'), nameOf(r), STATUS_LABEL[effectiveStatus(r)] || r.status].join(' · ')));
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
    var side = h('aside', { className: 'admin-side' },
      h(Z.ActionPanel, null,
        h(Z.Button, { hierarchy: 'primary', disabled: saving, onClick: save }, isNew ? 'Create' : 'Save'),
        isNew ? h(Z.Button, { hierarchy: 'secondary', href: '#attributes/' + kind.key }, 'Cancel')
              : h(Z.Button, { hierarchy: 'secondary', disabled: saving || n > 0, 'aria-describedby': n ? 'delete-why' : undefined,
                  onClick: function () { setConfirm('delete'); } }, 'Delete')),
      why ? h('p', { id: 'delete-why', className: 'body-small' }, why) : null,
      h('p', { className: 'admin-status body-small' + (message && message.error ? ' admin-status--error' : ''), role: 'status' }, message ? message.text : ''));

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

    return h('div', { className: 'admin-page admin-page--attribute' }, main, side, dialog);
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
      rates: (c.rates || []).map(function (r) { return { key: shipKey(), zone: r.zone_id, pkg: r.package_id, upTo: kgText(r.max_weight_g), service: r.service, price: centsToText(r.price_cents) }; })
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
      rates: f.rates.map(function (r) { return { zone_id: r.zone, package_id: r.pkg, max_weight_g: kgToGrams(r.upTo), service: r.service.trim(), price_cents: textToCents(r.price) }; })
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
          h('tbody', null, rows)));
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
    else body = h(Listings, { key: 'list-' + route.visit });

    return h('div', { className: 'admin' },
      session ? h('header', { className: 'admin-bar' },
        h('nav', { className: 'admin-bar__nav', 'aria-label': 'Admin' },
          h(Z.Button, { hierarchy: 'secondary', size: 'small', href: '#' }, 'Listings'),
          h(Z.Button, { hierarchy: 'secondary', size: 'small', href: '#attributes' }, 'Attributes'),
          h(Z.Button, { hierarchy: 'secondary', size: 'small', href: '#shipping' }, 'Shipping'),
          h(Z.Button, { hierarchy: 'primary', size: 'small', href: '#new' }, 'Create listing')),
        h('div', { className: 'admin-bar__nav' },
          h('span', { className: 'body-small' }, session.user.email),
          h(Z.Button, { hierarchy: 'secondary', size: 'small', onClick: function () { sb.auth.signOut(); } }, 'Sign out'))) : null,
      body);
  }

  window.ReactDOM.createRoot(document.getElementById('root')).render(h(App));
  // the toast region (decision 0049): its own root, rendered once and never again, so toast.js owns what goes in it
  window.ReactDOM.createRoot(document.getElementById('toasts')).render(h(Z.ToastRegion));
})();
