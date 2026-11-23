/* packages/listing-draft/listing-draft.js — the admin's listing model, shared (decision 0145).
   ONE mapping from a Discogs release to a listing: the admin (Create / Edit → Fetch Discogs, Memo → Create draft) and
   the Edge Function scanner-draft that the macOS Scanner calls to create a draft from a Discogs release.
   form = the admin's form state (emptyForm); patchFromDiscogs(form, release, entities) fills the release fields;
   payloadOf(form, status) = the payload of public.admin_save_listing; saveCredits then stores the Discogs credits (0146). release = the answer of discogs-lookup { releaseId }.
   entities = { artists, labels, genres, tags: [{ id, name }] } or null (then everything binds by name on save).
   No dependencies, no DOM. CommonJS (tests), classic script (window.ZanzaListingDraft), Deno via globalThis.
   The Edge Function holds a COPY (`npm run sync:functions`). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZanzaListingDraft = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var lineSeq = 0;   // line ids only need to be unique inside one form

  var FORMATS = ['7"', '10"', '12"', 'LP'];
  var MACRO_GENRES = ['Reggae', 'Funk / Soul', 'Hip Hop', 'Electronic', 'Jazz', 'Latin', 'Rock', 'Pop', 'Blues',
                      'Folk, World, & Country', 'Classical', 'Stage & Screen', 'Non-Music', "Children's", 'Brass & Military'];   // Discogs genres = our macro genre (0048)
  var COUNTRIES = [['JA', 'Jamaica'], ['UK', 'UK'], ['US', 'US'], ['CA', 'Canada'], ['DE', 'Germany'], ['FR', 'France'],
                   ['IT', 'Italy'], ['NL', 'Netherlands'], ['JP', 'Japan'], ['Europe', 'Europe'], ['Unknown', 'Unknown']];

  function textToCents(t) {
    var s = String(t || '').trim().replace(',', '.');
    if (!s) return null;
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
    return Math.round(parseFloat(s) * 100);
  }

  // a release link (…/release/249504-Artist-Title), its number, or Discogs' own [r249504]; a master link is not a release
  function discogsId(t) {
    var s = String(t || '').trim(), m = s.match(/\/release\/(\d+)/) || s.match(/^\[?r?(\d+)\]?$/i);
    return m ? parseInt(m[1], 10) : null;
  }

  function newLine(p) { return Object.assign({ id: 'l' + (++lineSeq), artists: [], artistCredit: '', artistSpelled: false, title: '' }, p); }

  function namesOf(chips) { return (chips || []).map(function (c) { return c.name; }).join(' & '); }

  function findEntity(list, text) {
    var t = String(text || '').trim().toLowerCase();
    if (!t || !list) return null;
    for (var i = 0; i < list.length; i++) if (list[i].name.toLowerCase() === t) return list[i];
    return null;
  }

  function differs(a, b) { return !!a && !!b && a.trim().toLowerCase() !== b.trim().toLowerCase(); }

  // ── empty form ────────────────────────────────────────────────────────────
  function emptyForm() {
    return {
      listingId: null, sku: null, status: 'draft', slug: null, checkoutUntil: null, soldAt: null, publishedAt: null, createdAt: null,
      customTitle: '', discogs: '', catNo: '',
      lines: [newLine()],
      label: [], labelCredit: '', labelSpelled: false, preRelease: false, country: '', year: '', format: '', section: 'sale', price: '',
      macroGenre: '', genres: [], tags: [],   // macro genre = a Discogs genre (Reggae), not shown in the shop; genres = Discogs styles (0048); tags = the shop's own (Rare, Killer version...)
      condition: '', conditionB: '', conditionNotes: '', sleeveType: 'generic', sleeveCondition: '',
      notes: '',
      images: [],    // { id, key, name, url, uploading }
      samples: [],   // { id, key, name, url, line (1-based) | null, uploading }
      credits: null  // the Discogs credits (0146) read with the release; null = not read now, the stored ones stay
    };
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

  // Discogs positions of the tracks that become lines (same filter as patchFromDiscogs): "A1", "B", …
  function positionsOf(d) { return (d.tracks || []).filter(function (t) { return t.title; }).map(function (t) { return String(t.position || '').toUpperCase(); }); }

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
        discogs: String(d.releaseId), lines: lines, samples: samples, credits: creditsOf(d),
        label: d.label ? [{ id: (findEntity(entities && entities.labels, d.label) || {}).id || null, name: d.label, discogsId: d.labelDiscogsId || null }] : [],
        labelCredit: '', labelSpelled: false, catNo: d.catNo || '', year: d.year ? String(d.year) : '',
        country: country ? country[0] : '', format: format, macroGenre: macroGenre,
        genres: (d.styles || []).map(function (n) { return { id: (findEntity(entities && entities.genres, n) || {}).id || null, name: n }; })
      },
      skipped: skipped
    };
  }

  // Credits (decision 0146): every Discogs credit (Producer, Mixed By …) as admin_set_release_credits takes them.
  // Not in the form UI: they are saved with the release and only searched in the shop (producers) for now.
  function creditsOf(d) {
    return (d.credits || []).map(function (c) {
      return { name: c.name, credit: c.credit || '', discogs_id: c.discogsId || null, role: c.role, tracks: c.tracks || '',
               variations: c.variations || [] };
    });
  }

  // after admin_save_listing: the credits of the payload replace those of the saved release. Without credits in the
  // payload (an edit without Fetch Discogs) the stored ones stay. rpc = supabase.rpc bound to the client.
  // Never fails the save: returns the error message or null.
  async function saveCredits(rpc, saved, payload) {
    if (!payload || !Array.isArray(payload.credits) || !saved || !saved.release_id) return null;
    try {
      var res = await rpc('admin_set_release_credits', { p_release_id: saved.release_id, p_credits: payload.credits });
      return res && res.error ? res.error.message : null;
    } catch (e) { return String((e && e.message) || e); }
  }

  // Year field (decision 0082): an exact year ("1983") or a decade ("1990s", stored as 1990 + year_precision 'decade')
  function parseYear(text) {
    var m = /^((?:19|20)\d\d)$/.exec(text.trim()) || /^((?:19|20)\d0)s$/i.exec(text.trim());
    if (!m) return null;
    return { year: m[1], precision: /s$/i.test(text.trim()) ? 'decade' : 'year' };
  }

  function yearText(year, precision) { return year ? String(year) + (precision === 'decade' ? 's' : '') : ''; }

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
      samples: f.samples.map(function (s) { return { line: s.line, audio_key: s.key, title: s.title || '' }; }),
      // not read by admin_save_listing: saveCredits sends them after the save (0146)
      credits: Array.isArray(f.credits) ? f.credits : undefined
    };
  }

  // the payload of a new draft made from a Discogs release only (Memo → Create draft, Scanner → New draft)
  function draftPayload(release, entities) {
    var f = emptyForm();
    Object.assign(f, patchFromDiscogs(f, release, entities).patch);
    return payloadOf(f, 'draft');
  }

  return {
    FORMATS: FORMATS, MACRO_GENRES: MACRO_GENRES, COUNTRIES: COUNTRIES,
    textToCents: textToCents, discogsId: discogsId, newLine: newLine, namesOf: namesOf, findEntity: findEntity, differs: differs,
    emptyForm: emptyForm, formatOf: formatOf, positionsOf: positionsOf, patchFromDiscogs: patchFromDiscogs,
    parseYear: parseYear, yearText: yearText, payloadOf: payloadOf, draftPayload: draftPayload,
    creditsOf: creditsOf, saveCredits: saveCredits
  };
});
