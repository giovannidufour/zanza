/* apps/admin/admin.js — the admin single-page app (React via createElement, no build step).
   Screens: sign-in (email link) · listings · create / edit listing (Figma BACKEND → Create).
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
  var GENRES = ['Reggae', 'Funk / Soul', 'Hip Hop', 'Electronic', 'Jazz', 'Latin', 'Rock', 'Pop', 'Blues',
                'Folk, World, & Country', 'Classical', 'Stage & Screen', 'Non-Music', "Children's", 'Brass & Military'];   // Discogs genres
  var COUNTRIES = [['JA', 'Jamaica'], ['UK', 'UK'], ['US', 'US'], ['CA', 'Canada'], ['DE', 'Germany'], ['FR', 'France'],
                   ['IT', 'Italy'], ['NL', 'Netherlands'], ['JP', 'Japan'], ['Europe', 'Europe'], ['Unknown', 'Unknown']];
  var STATUS_LABEL = { draft: 'Draft', available: 'Available', reserved: 'Reserved', sold: 'Sold', traded: 'Traded' };
  var STATUS_DONE = { draft: 'Unpublished.', available: 'Available again.', reserved: 'Reserved until you release it.', sold: 'Marked as sold.', traded: 'Marked as traded.' };
  var SLEEVES = [['original', 'Original'], ['generic', 'Generic'], ['none', 'None']];

  function mediaUrl(key) {
    if (!key) return '';
    if (/^https?:\/\//.test(key) || key.charAt(0) === '/') return key;
    return CFG.mediaBaseUrl ? CFG.mediaBaseUrl.replace(/\/$/, '') + '/' + key : '';
  }
  function fileNameOf(key) { return String(key || '').split('/').pop(); }
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

  // ── artists, labels and tags are entities (migrations 0006, 0007) ──────────
  // Each field is a chip field (Z.EntityField, decision 0020): a chip = an entity { id, name } (id null = new,
  // created on save). Artist and Label also have "Different spelling" → the name AS PRINTED on this record
  // (credit); the database learns it as an alias of the official name. Binding on save: id → Discogs id →
  // official name or alias → new entity.
  function newLine(p) { return Object.assign({ id: nextId(), artists: [], artistCredit: '', artistSpelled: false, title: '' }, p); }
  function chip(e) { return { id: e.id || null, name: e.name, discogsId: e.discogsId || null }; }
  function namesOf(chips) { return (chips || []).map(function (c) { return c.name; }).join(' & '); }
  // entities = { artists | labels | tags: [{ id, name, aliases: [] }] }, loaded once per form
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
    return Promise.all([one('artists', 'artist_aliases'), one('labels', 'label_aliases'), one('tags')])
      .then(function (r) { return { artists: r[0], labels: r[1], tags: r[2] }; });
  }

  // ── empty form ────────────────────────────────────────────────────────────
  function emptyForm() {
    return {
      listingId: null, sku: null, status: 'draft', slug: null, checkoutUntil: null, soldAt: null,
      customTitle: '', discogs: '', catNo: '',
      lines: [newLine()],
      label: [], labelCredit: '', labelSpelled: false, preRelease: false, country: '', year: '', format: '', section: 'sale', price: '',
      tags: [], genre: '',
      condition: '', conditionNotes: '', sleeveType: 'original', sleeveCondition: '',
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
    var tagRows = (r.tag_rows || []).slice().sort(function (a, b) { return a.position - b.position; });
    f.tags = tagRows.length ? tagRows.map(function (t) { return chip(t.tag); }) : (r.style || []).map(function (n) { return { id: null, name: n }; });
    f.genre = (r.genre || [])[0] || '';
    f.condition = row.condition_media || ''; f.conditionNotes = row.condition_notes || '';
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
    var genre = (d.genres || []).filter(function (g) { return GENRES.indexOf(g) >= 0; })[0] || '';
    if ((d.genres || []).length > 1) skipped.push('other genres ' + d.genres.filter(function (g) { return g !== genre; }).join(', '));
    return {
      patch: {
        discogs: String(d.releaseId), lines: lines, samples: samples,
        label: d.label ? [{ id: (findEntity(entities && entities.labels, d.label) || {}).id || null, name: d.label, discogsId: d.labelDiscogsId || null }] : [],
        labelCredit: '', labelSpelled: false, catNo: d.catNo || '', year: d.year ? String(d.year) : '',
        country: country ? country[0] : '', format: format, genre: genre,
        tags: (d.styles || []).map(function (n) { return { id: (findEntity(entities && entities.tags, n) || {}).id || null, name: n }; })
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
    if (!f.condition) e.condition = 'Choose the condition of the record.';
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
        genre: f.genre ? [f.genre] : [],
        style: f.tags.map(function (t) { return t.name; }),
        tags: f.tags.map(function (t) { return { id: t.id, name: t.name }; })
      },
      lines: f.lines.map(function (l) {
        return { artist: namesOf(l.artists), artist_credit: l.artistSpelled ? l.artistCredit : '', title: l.title,
                 artists: l.artists.map(function (a) { return { id: a.id, name: a.name, discogs_id: a.discogsId || null }; }) };
      }),
      listing: {
        section: f.section, status: status, price_cents: textToCents(f.price),
        condition_media: f.condition, condition_notes: f.conditionNotes,
        sleeve_type: f.sleeveType, condition_sleeve: f.sleeveType === 'none' ? '' : f.sleeveCondition,
        notes: f.notes, custom_title: f.customTitle,
        photo_keys: f.images.map(function (x) { return x.key; })
      },
      // only a title typed by Gio is stored; without it the shop shows the line title (data/products.js)
      samples: f.samples.map(function (s) { return { line: s.line, audio_key: s.key, title: s.title || '' }; })
    };
  }

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
    var locked = f.status === 'reserved' || f.status === 'sold' || f.status === 'traded';

    var main = h('div', { className: 'admin-main' },
      h('h1', { className: 'label-extra-large' }, isNew ? 'Create listing' : 'Edit listing'),

      h('section', { className: 'admin-section' },
        h(Z.Input, Object.assign({ id: 'custom-title', label: 'Custom title', optional: true,
          supportText: 'Replaces "Artist - Title" in the shop.' }, bind('customTitle'))),
        h(Z.Input, Object.assign({ id: 'discogs', label: 'Discogs match', optional: true, variant: 'search',
          placeholder: 'Release URL or number', supportText: errors.discogs ? undefined : 'Paste the release link, then Fetch Discogs.' }, bind('discogs'))),
        // Figma 2104:20728: secondary button right under Discogs match (gap 16)
        h('div', null, h(Z.Button, { hierarchy: 'secondary', disabled: locked, 'aria-busy': fetching || undefined, onClick: fetchDiscogs }, 'Fetch Discogs'))),
      h('hr', { className: 'admin-divider' }),

      h('section', { className: 'admin-section' },
        h('div', { className: 'admin-stack' },
          f.lines.map(function (l, i) {
            var samples = lineSamples(i);
            return h('div', { key: l.id, className: 'admin-line' },
              // Figma `line`: 8-column grid, gap 16 × 8; row 2 = Different spelling + Artist name on label
              h('div', { className: 'admin-row admin-row--tight' },
                h(Z.EntityField, { className: i === 0 ? 'span-4' : 'span-3', id: 'artist-' + i, label: 'Artist ' + (i + 1), optional: i > 0,
                  placeholder: l.artists.length ? 'Add artist' : (i > 0 ? 'Same as line 1' : 'Search or create'),
                  options: entities && entities.artists, value: l.artists, error: errors['artist-' + i],
                  onChange: function (chips, info) { setLineArtists(i, chips, info); } }),
                h(Z.Input, { className: 'span-4', id: 'title-' + i, label: 'Title ' + (i + 1),
                  value: l.title, error: errors['title-' + i], onChange: function (e) { setLine(i, 'title', e.target.value); } }),
                i > 0 ? h(Z.IconButton, { className: 'col-8', icon: h(Z.CloseIcon), 'aria-label': 'Remove line ' + (i + 1), onClick: function () { removeLine(i); } }) : null,
                h(Z.Checkbox, { className: i === 0 ? 'span-4' : 'span-3', label: 'Different spelling', checked: l.artistSpelled,
                  onChange: function (e) { setLine(i, 'artistSpelled', e.target.checked); } }),
                l.artistSpelled ? h(Z.Input, { className: 'span-4', id: 'artist-credit-' + i, label: 'Artist name on label',
                  value: l.artistCredit, onChange: function (e) { setLine(i, 'artistCredit', e.target.value); } }) : null),
              h('div', { className: 'admin-line__samples' },
                samples.length ? h(Z.FileList, null, samples.map(sampleItem)) : null,
                // one sample per line: the drop zone goes away once the line has one (back if it is removed)
                samples.length ? null : h(Z.DropZone, { label: 'Browse sample', accept: 'audio/mpeg', multiple: false, onFiles: addFiles('sample', i + 1) })));
          })),
        h('div', null, h(Z.Button, { hierarchy: 'secondary', onClick: addLine }, 'Add line'))),
      h('hr', { className: 'admin-divider' }),

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
      h('hr', { className: 'admin-divider' }),

      h('section', { className: 'admin-section' },
        h('div', { className: 'admin-row' },
          h(Z.EntityField, { className: 'span-4', id: 'tags', label: 'Tags', optional: true, placeholder: 'Add tag',
            options: entities && entities.tags, value: f.tags, onChange: function (chips) { set({ tags: chips }); } }),
          h(Z.Input, Object.assign({ className: 'span-4', id: 'genre', label: 'Genre', variant: 'select', placeholder: '' }, bind('genre')), opts(GENRES)))),
      h('hr', { className: 'admin-divider' }),

      h('section', { className: 'admin-section' },
        h('div', { className: 'admin-row' },
          h(Z.Input, Object.assign({ className: 'span-2', id: 'condition', label: 'Conditions', variant: 'select', placeholder: '' }, bind('condition')), opts(GRADES)),
          h(Z.Input, Object.assign({ className: 'span-6', id: 'condition-notes', label: 'Conditions comment', optional: true }, bind('conditionNotes')))),
        h('div', { className: 'admin-row' },
          h(Z.Input, Object.assign({ className: 'span-2', id: 'sleeve-type', label: 'Cover/sleeve', variant: 'select' }, bind('sleeveType')), opts(SLEEVES)),
          f.sleeveType !== 'none' ? h(Z.Input, Object.assign({ className: 'span-3', id: 'sleeve-condition', label: 'Cover/sleeve conditions', optional: true, variant: 'select', placeholder: '' }, bind('sleeveCondition')), opts(GRADES)) : null)),
      h('hr', { className: 'admin-divider' }),

      h('section', { className: 'admin-section' },
        h(Z.Input, Object.assign({ id: 'notes', label: 'Description / comment', optional: true }, bind('notes')))),
      h('hr', { className: 'admin-divider' }),

      h('section', { className: 'admin-section' },
        h('h2', { className: 'label-medium' }, 'Images'),
        f.images.length ? h(Z.FileList, { onMove: moveIn('images') }, f.images.map(function (x, i) {
          return fileItem('images', x, { image: { src: x.url }, featured: i === 0 });
        })) : null,
        h(Z.DropZone, { label: 'Browse image', accept: 'image/jpeg,image/png,image/webp', multiple: true, onFiles: addFiles('photo') })),
      h('hr', { className: 'admin-divider' }),

      h('section', { className: 'admin-section' },
        h('h2', { className: 'label-medium' }, 'Samples overview'),
        f.samples.length ? h(Z.FileList, { onMove: moveIn('samples') }, f.samples.map(overviewSampleItem)) : null,
        h(Z.DropZone, { label: 'Browse sample', accept: 'audio/mpeg', multiple: true, onFiles: addFiles('sample', null) })));

    var shopUrl = f.slug && f.status !== 'draft' && CFG.storefrontUrl ? CFG.storefrontUrl.replace(/\/$/, '') + '/products/' + f.slug + '/' : null;
    var side = h('aside', { className: 'admin-side' },
      h('div', { className: 'admin-side__actions' },
        h(Z.Button, { hierarchy: 'primary', disabled: saving || locked, onClick: function () { save('available'); } }, f.status === 'available' ? 'Update' : 'Publish now'),
        h(Z.Button, { hierarchy: 'secondary', disabled: saving || locked || f.status === 'available', onClick: function () { save('draft'); } }, 'Save draft'),
        h(Z.Button, { hierarchy: 'secondary', href: shopUrl || undefined, disabled: !shopUrl, target: '_blank', rel: 'noopener' }, 'Preview')),
      h('p', { className: 'admin-status body-small' + (message && message.error ? ' admin-status--error' : ''), role: 'status' }, message ? message.text : ''),
      h(Z.Input, { id: 'sku', label: 'Sku', readOnly: true, value: f.sku ? String(f.sku) : '', placeholder: 'On first save', supportText: 'Automatic-generated' }),
      locked ? h('p', { className: 'body-small' }, 'This copy is ' + f.status + ': it can no longer be edited here.') : null,
      isNew ? null : statusPanel());

    function statusPanel() {
      var closing = f.section === 'sale' ? 'sold' : 'traded';
      var actions = {
        draft: [],
        available: [[closing, f.section === 'sale' ? 'Mark as sold' : 'Mark as traded'], ['reserved', 'Reserve'], ['draft', 'Unpublish']],
        reserved: [[closing, f.section === 'sale' ? 'Mark as sold' : 'Mark as traded'], ['available', 'Release']],
        sold: [['available', 'Make available again']],
        traded: [['available', 'Make available again']]
      }[f.status] || [];
      var support = f.checkoutUntil ? 'Checkout in progress until ' + f.checkoutUntil.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '.'
        : f.soldAt && (f.status === 'sold' || f.status === 'traded') ? 'Since ' + new Date(f.soldAt).toLocaleDateString() + '.' : undefined;
      return h('section', { className: 'admin-section' },
        h(Z.Input, { id: 'status', label: 'Status', readOnly: true, value: STATUS_LABEL[f.status] || f.status, supportText: support }),
        actions.length ? h(Z.Input, { id: 'status-note', label: 'Status note', optional: true, value: statusNote,
          supportText: 'Kept in the history, e.g. "sold at the fair".', onChange: function (e) { setStatusNote(e.target.value); } }) : null,
        actions.map(function (a) {
          return h(Z.Button, { key: a[0], hierarchy: 'secondary', disabled: saving || !!f.checkoutUntil, onClick: function () { setStatus(a[0]); } }, a[1]);
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
  function Listings() {
    var st = useState(null), rows = st[0], setRows = st[1];
    var er = useState(null), error = er[0], setError = er[1];
    useEffect(function () {
      sb.from('listings').select('id,sku,slug,status,reserved_until,section,price_cents,custom_title,created_at,release:releases(lines:release_lines(position,artist,title))')
        .order('sku', { ascending: false })
        .then(function (res) { if (res.error) setError(res.error.message); else setRows(res.data); });
    }, []);
    if (error) return h('p', { className: 'body-medium admin-status--error', role: 'alert' }, 'Could not load the listings: ' + error);
    if (!rows) return h('p', { className: 'body-medium' }, 'Loading…');
    return h('div', { className: 'admin-section' },
      h('h1', { className: 'label-extra-large' }, 'Listings'),
      h('div', { className: 'admin-table-wrap' },
        h('table', { className: 'admin-table body-small' },
          h('thead', null, h('tr', null, ['SKU', 'Record', 'Status', 'Section', 'Price'].map(function (t) { return h('th', { key: t, className: t === 'SKU' || t === 'Price' ? 'num' : '' }, t); }))),
          h('tbody', null, rows.map(function (r) {
            return h('tr', { key: r.id },
              h('td', { className: 'num' }, r.sku),
              h('td', null, h('a', { href: '#edit-' + r.id }, nameOf(r))),
              h('td', null, STATUS_LABEL[effectiveStatus(r)] || r.status),
              h('td', null, r.section),
              h('td', { className: 'num' }, r.price_cents === null ? '' : centsToText(r.price_cents) + ' €'));
          })))));
  }

  function EditLoader(props) {
    var st = useState(null), initial = st[0], setInitial = st[1];
    var er = useState(null), error = er[0], setError = er[1];
    useEffect(function () {
      sb.from('listings').select('*,release:releases(*,label_entity:labels(id,name),tag_rows:release_tags(position,tag:tags(id,name)),lines:release_lines(*,credits:release_line_artists(position,artist:artists(id,name))),samples(*))').eq('id', props.id).single()
        .then(function (res) { if (res.error) setError(res.error.message); else setInitial(formFromRow(res.data)); });
    }, [props.id]);
    if (error) return h('p', { className: 'body-medium admin-status--error', role: 'alert' }, 'Could not open this listing: ' + error);
    if (!initial) return h('p', { className: 'body-medium' }, 'Loading…');
    return h(ListingForm, { initial: initial });
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
    else body = h(Listings, { key: 'list-' + route.visit });

    return h('div', { className: 'admin' },
      session ? h('header', { className: 'admin-bar' },
        h('nav', { className: 'admin-bar__nav', 'aria-label': 'Admin' },
          h(Z.Button, { hierarchy: 'secondary', size: 'small', href: '#' }, 'Listings'),
          h(Z.Button, { hierarchy: 'primary', size: 'small', href: '#new' }, 'Create listing')),
        h('div', { className: 'admin-bar__nav' },
          h('span', { className: 'body-small' }, session.user.email),
          h(Z.Button, { hierarchy: 'secondary', size: 'small', onClick: function () { sb.auth.signOut(); } }, 'Sign out'))) : null,
      body);
  }

  window.ReactDOM.createRoot(document.getElementById('root')).render(h(App));
})();
