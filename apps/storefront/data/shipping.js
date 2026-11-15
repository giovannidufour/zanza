/* apps/storefront/data/shipping.js — the shipping config for the build (decision 0057).
   Same source as the products (data/products.js): Supabase public.shipping_settings, or content/shipping.json with
   the local JSON source. Also the list of countries the bag offers ("Ship to"): only the ones the shop ships to,
   from the same config (decision 0075), with English names from Intl. */
'use strict';
const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '..');

async function fromSupabase(env, fetchImpl = fetch) {
  const res = await fetchImpl(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/shipping_settings?select=config`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Accept: 'application/json' }
  });
  // the table does not exist before migration 0015: the bag then says "Calculated at checkout", as before
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 404 || /PGRST205|42P01/.test(body)) return null;
    throw new Error(`Supabase shipping_settings: ${res.status} ${body}`);
  }
  const rows = await res.json();
  return rows[0] ? rows[0].config : null;
}

function fromJson() {
  const f = path.join(APP, 'content/shipping.json');
  if (!fs.existsSync(f)) return null;
  const { _note, ...config } = JSON.parse(fs.readFileSync(f, 'utf8'));
  return config;
}

// the countries the bag offers (decision 0075): the ones in a zone that has at least one rate, so a country added to a
// zone on the admin page Shipping appears with the next build. ISO 3166-1 alpha-2 (+ XK Kosovo), English names from
// Intl, sorted by name. An explicit list: Intl also knows retired codes (UK, YU, SU…) and non-countries (EU, UN), so a
// code outside it is dropped. Canary Islands, Ceuta etc. have no code of their own here: they are ES (customs
// territory: open point in design/open.md).
const ISO = ('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW ' +
  'BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO ' +
  'FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO ' +
  'JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS ' +
  'MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU ' +
  'RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA ' +
  'UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW').split(' ');
function countries(config, locale = 'en') {
  const rated = new Set(((config && config.rates) || []).map((r) => r.zone_id));
  const served = new Set(((config && config.zones) || []).filter((z) => rated.has(z.id))
    .flatMap((z) => (z.countries || []).map((c) => String(c).toUpperCase())));
  const names = new Intl.DisplayNames([locale], { type: 'region', fallback: 'code' });
  return ISO.filter((code) => served.has(code))
    .map((code) => ({ code, name: names.of(code) })).sort((x, y) => x.name.localeCompare(y.name, locale));
}

module.exports = { fromSupabase, fromJson, countries };
