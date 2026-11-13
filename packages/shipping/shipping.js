/* packages/shipping/shipping.js — the shipping estimate (decision 0057, Figma: page Shipping + Bag → bag summary).
   ONE calculation for the three places that need it: the bag (browser, an estimate), the admin page Shipping
   ("Check an order") and create-checkout (server, the price Stripe charges). No dependencies, no DOM.
   Works as a CommonJS module (build, tests) and as a classic script (window.ZanzaShipping) — also in Deno via globalThis.

   Config (public.shipping_settings.config, edited on the admin page Shipping):
     {
       formats:  [{ format: '7"', weight_g: 45 }, …],                         weight of one record with its sleeve
       packages: [{ id, name, weight_g: 250, max: { '7"': 10, 'LP': 5 } }, …],  a mailer and how many records of each
                                                                              format it takes (missing / 0 = none)
       zones:    [{ id, name, countries: ['AT', 'BE', …] }, …],                ISO 3166-1 alpha-2, a country in one zone
       rates:    [{ zone_id, package_id, max_weight_g, service, price_cents }, …],
       min_order_cents: 2000 | null                                            minimum order (decision 0072): the
                                                                              available records' subtotal, shipping
                                                                              excluded; null / 0 = no minimum
     }
   Rules (Gio 2026-11-12: "ogni mailer deve avere un massimo di dischi per formato"):
   · a parcel is full when Σ (records of a format / that format's max) reaches 1, so a mixed order shares the space
     (max 10 × 7" and 5 × LP: 2 LP + 5 × 7" = 0.4 + 0.5 = 0.9 → fits)
   · weight of a parcel = its records (the listing's own weight_g, else its format's) + the package's weight
   · rate of a parcel = for (zone of the country, package): the row with the smallest max_weight_g ≥ weight
   · the bag tries every package: one parcel if the order fits, otherwise as many parcels of that package as needed
     (largest records first); it keeps the cheapest total. Fewer parcels win a tie.
   A record whose format has no weight counts as the heaviest format (never under-charge). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZanzaShipping = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var FORMATS = ['7"', '10"', '12"', 'LP'];   // the closed list of the listing form
  var SIZE = { '7"': 1, '10"': 2, '12"': 3, 'LP': 3 };   // only to pack the largest records first

  function zoneOf(config, country) {
    var c = String(country || '').toUpperCase();
    return (config.zones || []).filter(function (z) { return (z.countries || []).indexOf(c) !== -1; })[0] || null;
  }

  // the shop ships somewhere at all: no rate = shipping is not set up, the bag says "Calculated at checkout"
  function isConfigured(config) { return !!(config && (config.rates || []).length); }

  function share(pkg, format) { var m = (pkg.max || {})[format]; return m > 0 ? 1 / m : Infinity; }

  // records → parcels of one package, first fit, largest records first; null if the package takes none of a format
  function packInto(pkg, items) {
    var sorted = items.slice().sort(function (a, b) { return (SIZE[b.format] || 3) - (SIZE[a.format] || 3); });
    var parcels = [];
    for (var i = 0; i < sorted.length; i++) {
      var s = share(pkg, sorted[i].format);
      if (s === Infinity) return null;
      var target = null;
      for (var j = 0; j < parcels.length; j++) if (parcels[j].fill + s <= 1 + 1e-9) { target = parcels[j]; break; }
      if (!target) { target = { fill: 0, items: [] }; parcels.push(target); }
      target.fill += s; target.items.push(sorted[i]);
    }
    return parcels;
  }

  function rateFor(config, zone, pkg, weight) {
    return (config.rates || [])
      .filter(function (r) { return r.zone_id === zone.id && r.package_id === pkg.id && r.max_weight_g >= weight; })
      .sort(function (a, b) { return a.max_weight_g - b.max_weight_g || a.price_cents - b.price_cents; })[0] || null;
  }

  /* items: [{ format: '12"', weight_g: null | number }] — one per record (a copy is unique: no quantity)
     → { status: 'ok', zone, price_cents, parcels: [{ package, weight_g, rate: { service, price_cents }, items }] }
     | { status: 'empty' } | { status: 'not-configured' } | { status: 'not-served', country }
     | { status: 'no-package' } (no package takes every format of the order)
     | { status: 'too-heavy', zone } (a parcel is heavier than every rate of its package) */
  function estimate(config, items, country) {
    if (!isConfigured(config)) return { status: 'not-configured' };
    if (!items || !items.length) return { status: 'empty' };
    var zone = zoneOf(config, country);
    if (!zone) return { status: 'not-served', country: country };

    var weights = {}, heaviest = 0;
    (config.formats || []).forEach(function (f) { weights[f.format] = f.weight_g; if (f.weight_g > heaviest) heaviest = f.weight_g; });
    function weightOf(it) { return it.weight_g > 0 ? it.weight_g : (weights[it.format] > 0 ? weights[it.format] : heaviest); }

    var best = null, packable = false;
    (config.packages || []).forEach(function (pkg) {
      var parcels = packInto(pkg, items);
      if (!parcels) return;
      packable = true;
      var total = 0, out = [];
      for (var i = 0; i < parcels.length; i++) {
        var w = (pkg.weight_g || 0);
        parcels[i].items.forEach(function (it) { w += weightOf(it); });
        var rate = rateFor(config, zone, pkg, w);
        if (!rate) return;
        total += rate.price_cents;
        out.push({ package: pkg, weight_g: w, rate: { service: rate.service, price_cents: rate.price_cents }, items: parcels[i].items });
      }
      if (!best || total < best.price_cents || (total === best.price_cents && out.length < best.parcels.length)) best = { price_cents: total, parcels: out };
    });
    if (!packable) return { status: 'no-package' };
    if (!best) return { status: 'too-heavy', zone: zone };
    return { status: 'ok', zone: zone, price_cents: best.price_cents, parcels: best.parcels };
  }

  /* minimum order (decision 0072, Gio 2026-11-13): the subtotal of the records being bought (available lines only,
     shipping excluded) must reach config.min_order_cents. Not a shipping rule, but it lives in the same settings row
     (one admin page, one Save, one rebuild) and must be checked by the same code in the bag and in create-checkout.
     → { min_cents, missing_cents, ok } — min_cents 0 = no minimum, always ok. */
  function minimumOf(config) { var m = config && config.min_order_cents; return m > 0 ? m : 0; }
  function minimumOrder(config, subtotalCents) {
    var min = minimumOf(config);
    var missing = Math.max(0, min - (subtotalCents > 0 ? subtotalCents : 0));
    return { min_cents: min, missing_cents: missing, ok: missing === 0 };
  }

  /* problems of a config before it is saved (admin) or used (server): [] = fine. Plain sentences for the admin. */
  function validate(config) {
    var errors = [];
    var c = config || {};
    var pkgIds = {}, zoneIds = {}, seen = {};
    (c.formats || []).forEach(function (f) {
      if (FORMATS.indexOf(f.format) === -1) errors.push('Unknown format ' + f.format + '.');
      if (!(f.weight_g > 0)) errors.push('Weight of ' + f.format + ': a number of grams above 0.');
    });
    (c.packages || []).forEach(function (p, i) {
      if (!String(p.name || '').trim()) errors.push('Package ' + (i + 1) + ': name missing.');
      var takes = FORMATS.filter(function (f) { return (p.max || {})[f] > 0; });
      if (!takes.length) errors.push('Package “' + (p.name || i + 1) + '”: give a maximum of records for at least one format.');
      FORMATS.forEach(function (f) { var m = (p.max || {})[f]; if (m !== undefined && m !== null && !(m >= 0 && m % 1 === 0)) errors.push('Package “' + (p.name || i + 1) + '”: maximum of ' + f + ' must be a whole number.'); });
      if (!(p.weight_g >= 0)) errors.push('Package “' + (p.name || i + 1) + '”: weight in grams, 0 or more.');
      pkgIds[p.id] = true;
    });
    (c.zones || []).forEach(function (z, i) {
      if (!String(z.name || '').trim()) errors.push('Zone ' + (i + 1) + ': name missing.');
      (z.countries || []).forEach(function (code) {
        if (!/^[A-Z]{2}$/.test(code)) errors.push('Zone “' + (z.name || i + 1) + '”: “' + code + '” is not a two-letter country code.');
        else if (seen[code]) errors.push(code + ' is in two zones (“' + seen[code] + '” and “' + z.name + '”).');
        else seen[code] = z.name;
      });
      zoneIds[z.id] = true;
    });
    (c.rates || []).forEach(function (r, i) {
      var n = 'Rate ' + (i + 1);
      if (!zoneIds[r.zone_id]) errors.push(n + ': pick a zone.');
      if (!pkgIds[r.package_id]) errors.push(n + ': pick a package.');
      if (!(r.max_weight_g > 0)) errors.push(n + ': “Up to” must be a weight above 0.');
      if (!String(r.service || '').trim()) errors.push(n + ': service missing (it is shown at checkout).');
      if (!(r.price_cents >= 0)) errors.push(n + ': price missing.');
    });
    var m = c.min_order_cents;
    if (m !== undefined && m !== null && !(m >= 0 && m % 1 === 0)) errors.push('Minimum order: an amount in euros, like 20 or 20,50 (empty = no minimum).');
    return errors;
  }

  return { estimate: estimate, validate: validate, minimumOrder: minimumOrder, zoneOf: zoneOf, isConfigured: isConfigured, FORMATS: FORMATS };
});
