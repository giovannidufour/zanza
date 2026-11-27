# HIGHMUZIK (ex rythem-works, ex Zanza) — Project Summary

> Leggi questo file all'inizio di ogni sessione su HIGHMUZIK (ex rythem-works, ex Zanza). Rinomina in corso dal 2026-11-25 (decisione 0182): checklist in `_context/provisional-names.md` → "Rinomina → HIGHMUZIK". Il repo GitHub e la cartella sul Mac si chiamano ancora `zanza` finché Gio non li rinomina.
> Poi leggi i file in `_context/` prima di rispondere. Non proporre feature senza aver letto `open-questions.md`.

---

## What It Is

**HIGHMUZIK** (nome scelto da Gio il 2026-11-25, **sempre in maiuscolo**, anche in Figma; dominio highmuzik.com. Prima: "Zanza" provvisorio, "rythem-trax" per un giorno, rythem-works dal 15 al 25/11; decisione 0182) — e-commerce headless di dischi in vinile con due sezioni:

- **For Sale** — e-commerce classico: PLP, PDP, carrello, checkout, account, preferiti
- **For Trade** — PDP di dischi NON in vendita, con CTA **Trade** che apre un form di proposta di scambio

Da PLP e PDP si può fare **play dei sample** audio (player persistente durante la navigazione).

Architettura: **headless**, frontend custom, servizi terzi per commerce/pagamenti/media.

---

## Rapporto con gli altri progetti personali

| Progetto | Cosa condivide | Cosa NO |
|---|---|---|
| `Vinyl Swap/` | il concetto di scambio di vinili, i vincoli Discogs (`_context/discogs-api.md` vale anche qui) | Vinyl Swap è P2P (utente↔utente via wantlist Discogs); Zanza For Trade è utente↔negozio (vedi Q2) |
| `Crate Witch/` | card disco, naming token in inglese, idea "play del catalogo senza hostare audio" | codice e DS separati, non riusare `app/` |

---

## Status

| | |
|---|---|
| Fase | 🟡 Prototipo statico (PLP + PDP) · stack backend deciso (`_context/stack.md`) |
| Owner | Gio |
| Prossimo passo | Ordine concordato il 2026-11-09 ("disegna ciò che serve per vendere; il DS cresce on demand"): **1.** admin, flusso *crea listing* (Figma → componenti form in `packages/ui`) + in parallelo Supabase/migrazione · **2.** stati di vendita su PLP/PDP (sold, reserved, appena venduto, senza sample/foto) · **3.** carrello minimo (bag UI + pagina `/bag/` fatti 2026-11-10, decisione 0044; manca create-checkout) + pagine di esito di Stripe Checkout · **4.** pagine legali DE (Impressum, Datenschutz, Widerruf, spedizioni). Prima di rifinire la PDP: 5 dischi veri fotografati e registrati da Gio |
| In pausa | Trade, account, preferiti (Q2 aperta) · branding/logo (Q7 nome provvisorio) |

---

## Cosa c'è dove

| File | Contenuto |
|---|---|
| `_context/product-brief.md` | Cos'è, flussi, modello dati, feedback di prodotto |
| `_context/stack.md` | Stack deciso (Supabase + R2 + Stripe Checkout + admin custom), portabilità, tasse |
| `_context/backend.md` | Schema DB, chiavi di storage, flussi (upload, hold/checkout, pubblicazione) |
| `_context/email-setup.md` | Email transazionali (Resend): config attuale e runbook per rifarla con nome/dominio/email nuovi |
| `_context/open-questions.md` | Decisioni aperte — da chiudere prima del codice |
| `_context/provisional-names.md` | **Registro di dove si usano il nome dello store (ex provvisorio "Zanza", ora rythem-works) e l'email personale, con lo stato della rinomina** (account, username, URL, codice). Ogni thread che ne aggiunge uno aggiunge la riga qui |
| `design/README.md` | Mappa della documentazione DS + flusso Figma → codice + checklist di porting di un componente |
| `design/decisions/` | **Il perché**: una decisione di design per file (inglese, append-only, con la *Rule* da applicare). Leggere prima di portare o modificare un componente |
| `design/open.md` | **L'unico backlog** di gap, parcheggi e fix Figma. Una voce chiusa diventa una decisione |
| `packages/ui/` | **Design system in codice — unica fonte dei componenti.** `tokens.json` (mirror delle variabili Figma) → `tokens.css` (generato, mai a mano) · `media.js` (espande `@media (--mobile)` dal gruppo `breakpoint` di tokens.json: il breakpoint vive solo lì) · `components.js` (React, createElement, UMD) · `components.css` · `toast.js` (comportamento dei toast senza framework, stesso file in shop e admin, decisione 0049) |
| `apps/storefront/` | Sito statico. `content/products/*.json` (modello del brief) · `pages/shell.js` (header, ProductCard da prodotto, mapping dati→testo condivisi) · `pages/pdp.js` · `pages/plp.js` (listing `/sale/` e risultati `/search/?q=`, filtri dai dati, decisioni 0028, 0061) · `pages/bag.js` (bag `/bag/`, decisione 0044: righe nascoste per ogni listing sale, il bag vive in localStorage) · `pages/trade.js` + `trade.css` (trade, decisione 0068; si accende/spegne da admin → Settings, decisione 0102: azioni della PDP trade, pagina offerta `/products/<slug>/offer/`, `/how-trading-works/`, `/about/`; dati di Gio in `site.json` → owner, endpoint in → trade) · `pages/home.js` + `home.css` (home `/`, decisione 0120 che sostituisce 0085: intro, generi + vista griglia/lista, scaffali This week e Recent (solo sale) attorno al box newsletter; sotto l'intro le card delle collezioni, decisione 0174; `/catalog/`, PLP di tutti i dischi, resta ma non è più linkata) · `/collections/<slug>/` (collezioni curate, decisione 0174: Plp con `collection`, regole in admin → Collections, esempi per la build JSON in `content/collections.json`; in ogni PLP i sold out vanno in fondo, `Plp.soldLast`) · `pages/account.js` + `account.css` + `scripts/account.js` (account cliente, decisione 0101: login con codice email, ordini da Supabase `customer_orders()`, pagine `/account/`, `/account/order/`, `/account/details/`) · `/bargain-crate/` (Bargain crate, decisione 0201: Plp con section `bargain`, i listing con `bargain`; nelle altre PLP nascosti finché non si spunta "Show bargain crate") · `/wantlist/` (Check your wantlist, decisione 0152: Plp con `wantlist`, logica in `scripts/site.js` → initWantlist; switch admin → Settings) · `pages/offer.js` (Best offer, decisione 0158: form `/products/<slug>/offer/`, `/offer/confirm/`, `/offer/pay/`) · `pages/contact.js` (`/contact/`: email + form, decisione 0093) · `pages/legal.js` + `legal.css` (Privacy, Terms, Shipping, decisioni 0079 e 0093: testi in `content/legal/*.md`, dati di Gio in `site.json` → legal) · `fonts.css` (Inter servito dal sito, niente Google Fonts) · `base.css` (reset + page shell) · `pdp.css` / `plp.css` / `bag.css` (grid di pagina) · `scripts/site.js` (comportamenti di sito: header sticky allo scroll up, player, navigazione soft, filtri PLP, bag: Add to bag, conteggio nell'header, pagina /bag/) · `scripts/analytics.js` (PostHog EU senza cookie né registrazioni, solo negozio, decisione 0131: heatmap, web vitals, eventi; ogni pagina passa `template` a `page()`; chiave in `site.json` → analytics) · `site.json` (storeName, outputDir, basePath, mediaBaseUrl = base URL delle chiavi media su R2, vuoto finché non c'è) · `data/products.js` (da dove arrivano i prodotti: **Supabase** se esiste `apps/storefront/.supabase.env` (git-ignored: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`), altrimenti i JSON di `content/`; `node apps/storefront/build.js --source=json` forza i JSON) · `build.js` → **`dist/zanza/` = la cartella da caricare via FTP** |
| `packages/content/` | `content.js`: i testi che Gio modifica nell'admin (pagina Content, decisione 0106): blocchi, campi, default = i testi di oggi nel repo; lo usano admin (build.js lo serializza) e build del negozio. Valori salvati in Supabase `site_texts` |
| `packages/file-names/` | `file-names.js`: i nomi dei file di scansioni e clip `<sku>_<role>_<slug>` (decisione 0136), lo stesso file per admin (File names) e per la Edge Function `scan-targets` dello Scanner macOS (0138) |
| `packages/listing-draft/` | `listing-draft.js`: il modello del listing dell'admin (mapping Discogs → form → payload di `admin_save_listing`), lo stesso file per admin e per le Edge Function `scanner-draft` dello Scanner (decisione 0145) e `release-credits` (0148) |
| `packages/collections/` | `collections.js`: quali dischi stanno in una collezione (Years / Genres / Tags, AND tra regole, OR dentro), lo stesso file per la build del negozio e per admin → Collections (decisione 0174, migration 0038) |
| `packages/pagination/` | `pagination.js`: quali numeri di pagina mostra la paginazione delle PLP (prima, ultima, corrente ± 1, "…"), lo stesso file per la build e per il browser (decisione 0179; record per pagina in admin → Settings, migration 0039) |
| `packages/crate-photo/` | `crate-photo.js`: admin → Take photo (decisione 0200): da una foto del telefono di un 7" ai due ritagli dello Scanner (Full 180 mm, Label 96.52 mm), prospettiva dal foglio A4 o dal bordo, centro sul buco, luce uniformata sulla carta. JS puro, testabile in Node |
| `packages/audio/` | `web-level.js`: il volume dei sample del negozio (copia 128 kbps): loudness −11 LUFS + limiter leggero, lo stesso file per admin (upload e clip) e Scanner (Push to admin, via JavaScriptCore). WAV e MP3 320 restano col +8 dB di 0157 (decisione 0192) |
| `packages/shipping/` | `shipping.js`: stima della spedizione (pesi, mailer con max dischi per formato, zone, tariffe), lo stesso file per Bag, admin Shipping e create-checkout (decisione 0057) |
| `apps/scanner/` | **Zanza Scanner**, app macOS (SwiftUI + ImageCaptureCore) per scansionare le etichette con la CanoScan LiDE 100 direttamente col nome file di 0136 (decisione 0137). `apps/scanner/build.sh` → `build/Zanza Scanner.app` (solo Command Line Tools, niente Xcode; firma ad hoc). Decisioni successive: 0138, 0141–0145, 0147 (free scans), 0149 (toast con Undo), 0177 (video quadrato per clip, label + sample) |
| `supabase/` | `functions/` (Edge Functions, deploy dal dashboard; `trade-offer` = offerte di scambio via email, 0068; `discogs-search` = release Discogs nel campo "Which record", 0069; `read-label` = foto della label in Create listing letta da Cloudflare Workers AI gratis, 0090 (Memo tolto, 0171); `contact` = form di /contact/ via email, 0093; `scan-targets` = draft e nomi dei file per lo Scanner macOS, sola lettura, 0138; `scanner-push` = Push to admin dello Scanner, aggancia al draft foto e clip già caricate, 0142; `scanner-draft` = New draft dello Scanner da una release Discogs, 0145; `release-credits` = backfill una tantum dei credits Discogs (produttori cercabili), 0148; `discogs-oauth` = Check your wantlist, login Discogs del visitatore: la funzione firma soltanto, la wantlist la legge e la confronta il browser, 0152; `offer` = Best offer, offerte dei compratori con anti-bot e pagina di pagamento, 0158; `offer-decide` = Accept / Decline dall'admin → Offers, 0158) · `migrations/` (schema DB, fonte di verità; applicate a mano dall'editor SQL del progetto `store-staging`) · `scripts/build-seed.js` → `seed.sql` (dati di prova da `content/products/`) |
| `package.json` | `npm run build` (tokens.css + dist/) · `npm run build:artifact` (cartella da pubblicare come artifact DS) · `npm run deploy` / `npm run build:deploy` (upload FTPS di `dist/zanza/` → `public_html/zanza` su GoDaddy, https://gio-d.xyz/zanza/). Claude lancia build e deploy; Gio non usa il terminale. Dopo l'upload il deploy verifica il sito da solo (solo i file di `dist/`, uno al secondo; `npm run deploy -- --verify` per rifarlo). **Mai** richiedere al sito percorsi del progetto (`.git`, `node_modules`, config): l'host banna l'IP |
| Git / deploy | **GitHub `giovannidufour/zanza` (privato), branch `main` = fonte di verità**; la cartella sul Mac è una copia di lavoro. **Negozio: Cloudflare Pages `store-front` → https://rythem-works.com** (anche https://store-front-6fx.pages.dev; admin su https://admin.rythem-works.com, media su https://media.rythem-works.com, `_context/stack.md` → Dominio) (`npm run build:pages`), si ricostruisce da solo a ogni push su `main` e, via deploy hook, quando cambia un listing pubblico (`_context/backend.md` → Pubblicazione). Admin: Pages `store-admin`, pubblicato da GitHub Actions a ogni push su `main` che tocca admin o `packages/ui` (`.github/workflows/deploy-admin.yml`). GoDaddy = staging di riserva (sotto). `apps/storefront/deploy.js` + `deploy.json` (host, remoteDir). Credenziali FTP in `apps/storefront/.deploy.env` (git-ignored, mai committare né stampare). Il deploy carica/sovrascrive soltanto: i file rimossi in locale restano sul server |

## Stato del porting

Componenti portati: tabella in `packages/ui/README.md`. Aperti: `design/open.md`. Non duplicare qui.

## Regole del codice

- `packages/ui` è l'unica implementazione dei componenti: l'artifact "rythem-works Design System" (ex "Zanza Design System") (claude.ai) va rigenerato da qui, non scritto a parte
- Nessun valore visivo inventato: colori solo via token; dimensioni = quelle in Figma; se manca (focus, breakpoint) resta un TODO dichiarato
- Figma: segnalare sempre refusi e residui di altri file; rinominare i layer anonimi dei componenti su cui si lavora
- Dati finti in `content/` con già la forma del modello dati, così il backend sostituisce la sorgente e non le pagine

## Regole fisse

- **Tutto in inglese nel codice**: codice, commenti, nomi di file/cartelle, variabili, token, commit, nomi DB. Gio parla in italiano in chat, ma il progetto è in inglese. La documentazione di contesto in `_context/` resta in italiano.

## Naming

- **copy** = la singola copia fisica (condizione, prezzo). Un disco in vendita è quasi sempre 1 copy, non uno SKU con quantità
- **release** = pressatura specifica (id Discogs); **master** = l'opera
- **listing** = una copy pubblicata, in sezione `sale` o `trade`
- **proposal** = proposta di scambio inviata da un utente su un listing `trade`
- **sample** = clip audio di una traccia (30–60 s), non la traccia intera
- **genre** = lo style Discogs (Roots, Dancehall…): è quello che il negozio mostra e filtra. **macro genre** = il genre Discogs (quasi sempre Reggae), salvato ma non mostrato. Fino al 2026-11-10 si chiamavano subgenre e genre (decisione 0048)

## Come aggiornare i file

1. Decisione di prodotto → aggiorna `product-brief.md` e chiudi la voce in `open-questions.md`
2. Scelta tecnica → `stack.md`
3. Decisione di design (anche presa in chat) → nuovo file in `design/decisions/` + riga nell'indice; se chiude un aperto, toglilo da `design/open.md`
4. Gap o fix Figma emerso nel porting → `design/open.md`, non nei README dei componenti
5. API di un componente → `components.d.ts` (la tabella nei README è generata da `build-docs.js`)
6. Cambia la struttura → aggiorna questo file

---

_Last updated: 2026-11-10_
