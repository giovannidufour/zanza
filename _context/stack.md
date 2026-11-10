# Zanza — Stack (decisione 2026-11-09)

Vincoli dati da Gio: **headless**, appoggiarsi a **servizi terzi**, codice in **inglese**, **costo fisso il più vicino possibile a 0**.

## Decisione: Supabase + Stripe Checkout + admin custom ✅

Scelta da Gio il 2026-11-09 (era l'opzione C della versione del 31/10).

**Perché (input di Gio, 2026-11-09):**
- un solo venditore e un solo operatore (Gio) → niente ruoli, niente marketplace
- volume basso: ~40 dischi all'avvio, poi 10–20 a settimana
- ogni disco è **sempre una copia unica** → inventario = una riga per copia, niente SKU/quantità
- budget: risparmiare il più possibile
- l'interfaccia di creazione dei listing la disegna Gio (fa parte del prodotto)
- i sample li registra Gio dai suoi dischi

Medusa 2 (ex opzione B) scartata: costo fisso ~15 €/mese e un admin già fatto, mentre Gio lo vuole disegnare lui; resi, magazzino multi-unità e multi-operatore non servono. **Quando rivalutarla:** più venditori, più operatori, resi/rimborsi frequenti, o oltre ~5.000 copie.

## Architettura

| Pezzo | Servizio | Costo | Note |
|---|---|---|---|
| DB + auth admin + funzioni server | **Supabase** (free) | 0 € | Postgres, RLS, Edge Functions. ⚠️ il piano free si mette in pausa dopo 7 giorni di inattività |
| File: cover, foto, sample | **Cloudflare R2** | 0 € fino a 10 GB, nessun costo di traffico | nel DB solo la **chiave** (`samples/<release_id>/A.mp3`), mai l'URL completo |
| Admin | SPA statica React con `packages/ui` (`apps/admin`) su **Cloudflare Pages**, progetto `store-admin` → **https://store-admin-3k1.pages.dev** (il nome senza suffisso era preso; questo URL è anche in Supabase Auth Site URL/Redirect, CORS del bucket R2 e default `ADMIN_ORIGINS` di `sign-upload`) (scelta di Gio 2026-11-10: non dipende da GoDaddy né dal blocco IP) | 0 € | `npm run deploy:admin` (wrangler) · upload diretto su R2 con URL firmato; resize immagini nel browser |
| Checkout | **Stripe Checkout** | solo % a transazione | pagamento, indirizzo, tariffe di spedizione per zona |
| Email transazionali | Resend (free, 3.000/mese) | 0 € | conferma ordine |
| Storefront | statico, `build.js` legge da Supabase | 0 € | **Cloudflare Pages** collegato a GitHub, ricostruzione automatica quando cambia un listing (scelta di Gio 2026-11-10, `backend.md` → Pubblicazione). GoDaddy resta come riserva finché Pages non è verificato |

Dettaglio di schema, flussi e storage: `backend.md`.

### Account creati (2026-11-09, tutti con l'email personale di Gio)
| Servizio | Cosa | Note |
|---|---|---|
| Supabase | org "Gios" (free) → progetto `store-staging`, ref `hhpknvyfypqipxufmbys`, regione eu-central-1 (Frankfurt) | "Automatically expose new tables" **off**, "automatic RLS" **on**. Password DB nel password manager di Gio. Nella stessa org c'è un progetto non correlato in pausa ("love planner"): il free tier conta i progetti *attivi* (max 2) |
| Cloudflare R2 | stesso account Cloudflare di gio-d.xyz, bucket `store-media` (Standard, posizione automatica EEUR) | lettura pubblica via Public Development URL `https://pub-a98e506f6d2e48c49301fca9123a3b20.r2.dev` (attivato 2026-11-10; rate-limited, da sostituire con dominio custom in produzione). Scrittura solo con URL firmato da `sign-upload` |
| Stripe | account `acct_1RGEAj2LZr7JToM4`, paese **Germany**, solo **sandbox/test** | non attivare i pagamenti live prima di Q5b e del nome. Fuso orario account = Europe/Berlin (impostato il 2026-11-10) |

Chiavi API: mai in chat né nel repo; andranno in un `.env` git-ignored sul Mac.

**GoDaddy serve solo file statici.** Nessuna richiesta di admin, upload o API passa da lì (hosting condiviso PHP/MySQL, e il firewall banna gli IP che fanno raffiche di richieste).

## Cosa scriviamo noi (e Medusa avrebbe dato pronto)
- hold della copia al checkout + rilascio alla scadenza
- webhook Stripe → `sold` + ordine
- email di conferma
- ordini/rimborsi: **dalla dashboard Stripe, a mano** (ok per il volume attuale)

## Portabilità (staging → nuovo dominio)
Tutto ciò che dipende dal dominio vive in configurazione, mai nel DB o nel codice:
`basePath`, base URL dei media, URL Supabase, origini CORS, URL di successo/annullamento del checkout, webhook Stripe, mittente email.
Non legare un sottodominio media a `gio-d.xyz`: usare l'URL pubblico di R2 finché non c'è il dominio definitivo.
**Al cambio dominio:** storefront e admin su **Cloudflare Pages** (gratis, ricostruzione automatica quando si pubblica dall'admin), GoDaddy dismesso. *Proposta, da confermare.*

## Tasse e spedizioni (Gio ha sede a Berlino, vende in tutto il mondo)
Da verificare con uno **Steuerberater** prima del checkout:
- **Kleinunternehmer (§19 UStG)**: se applicabile, niente IVA in fattura → tutto molto più semplice
- **Differenzbesteuerung** (regime del margine) per l'usato comprato da privati
- UE B2C oltre la soglia: IVA OSS; extra-UE: senza IVA ma con dogana (CN22/CN23)

**Proposta:** partire con **UE + UK/CH/US** e tariffe fisse per zona e formato, poi allargare.

## Servizi rimandati
| Bisogno | Servizio | Quando |
|---|---|---|
| Ricerca/filtri PLP | Postgres finché < ~2k copie, poi Meilisearch | non prima di un anno al ritmo attuale |
| Analytics | Plausible | i ToU Discogs vietano di esportare dati verso terzi (niente GA) |
| Trade (proposals) | tabelle in più nello stesso Supabase | dopo il checkout; Q2 aperta |
| Frontend Next.js | — | solo se il sito statico + `site.js` non basta più (carrello/account) |

_Last updated: 2026-11-10_
