# Nomi ed email provvisori — registro

> Il nome provvisorio era "Zanza". **Dal 2026-11-15 lo store si chiama `rythem-works`** (grafia di Gio: *rythem*, non *rhythm*; minuscolo, col trattino). Dal 14 al 15/11 era `rythem-trax`: abbandonato perché il dominio rythem-tracks.com non era disponibile. Dominio e marchio di rythem-works da verificare (Q7). Gli account usano l'email personale di Gio **per scelta** (solo login e gestione); tutto ciò che vedono clienti e iscritti usa `gio@rythem-works.com` (`email-setup.md` → Caselle).
> Questa è la lista di **tutto** quello che porta il nome o l'email: la sezione sotto dice cosa è già passato a rythem-works e cosa no.
> **Regola:** ogni volta che un thread usa il nome, l'email o un identificativo legato a loro (account, username, URL, chiave localStorage…), aggiunge una riga qui nello stesso commit.

Legenda colonna *Cambio*: 🟢 facile (testo/config) · 🟡 da pianificare (URL pubblici, dati utente, redirect) · 🔴 difficile o impossibile (identificativo fisso: si crea un nuovo account/progetto).

## Rinomina → HIGHMUZIK (dal 2026-11-25, decisione 0182) — CHECKLIST

Gio: nome **HIGHMUZIK, sempre maiuscolo** (testi, email, Figma), dominio **highmuzik.com**, tutto rinominato compresi gli identificatori interni. rythem-works.com: auto-renew spento il 2026-11-25, scade il 2027-11-15; fino ad allora redirect 301 a highmuzik.com. Legenda: **[G]** = lo fa Gio (account, credenziali, pagamenti, dati fiscali) · **[C]** = Claude (browser di Gio o PR).

**Fase 1 — dominio**
- [x] [C] auto-renew rythem-works.com OFF (2026-11-25)
- [x] [G] VAT-ID nel billing Cloudflare (fattura), poi acquisto highmuzik.com ($11.17/anno) con ok di Gio

**Fase 2 — PR A, nome e identificatori (non dipende dal dominio)**
- [x] [C] (PR #257) `storeName`, testi, DS (`tokens.json`, artifact), Scanner (nome, bundle id `com.highmuzik.scanner`, cartelle `HIGHMUZIK samples/scans/videos`), `hm-` al posto di `zz-`, `window.Highmuzik*`, chiavi `highmuzik-*`, `package.json`, GoDaddy legacy `/highmuzik`
- [x] [C/Mac] (PR #262, 2026-11-25) ricompilare l'app Mac, che ora si chiama **ZANZA** (decisione 0184: strumento della piattaforma, bundle id resta `xyz.gio-d.zanza.scanner`, nessuna cartella né login da spostare) e installarla al posto di Zanza Scanner
- [x] [C] Supabase secret `STORE_NAME` = HIGHMUZIK (con ok di Gio)
- [x] [C] Figma: store name nel `header`, coming soon, copyright footer, legal (thread del logo, 0183); il file Figma resta "zanza" (Gio 2026-11-25: Zanza = piattaforma, HIGHMUZIK = store)

**Fase 3 — DNS e hosting (highmuzik.com)**
- [x] [C] Pages: `coming-soon` su apex + www · `store-front` su `staging.` · `store-admin` su `admin.` · R2 `store-media` su `media.` (+ CORS R2 con admin.highmuzik.com)
- [x] [C] Access: app `staging` su staging.highmuzik.com; team Zero Trust resta `rythem-works` (Gio 2026-11-25: lo vede solo lui, sparisce al lancio)
- [x] [C] rythem-works.com: Redirect Rule 301 → highmuzik.com (path e query conservati), tutti i sottodomini
- [x] [C] Supabase Auth: Site URL + redirect `https://admin.highmuzik.com/**`; secrets `ADMIN_ORIGINS`, `ALLOWED_ORIGINS`, `SHOP_URL`, `ADMIN_URL`, `MEDIA_BASE_URL` (ok di Gio)

**Fase 4 — email**
- [x] [G] nuova Gmail della casella del negozio: `gio.highmuzik@gmail.com`, solo per transazionali e clienti. TUTTI i login degli account (Cloudflare, Supabase, GitHub, Resend, Buttondown, login admin) restano sulla Gmail personale di Gio
- [x] [C] Email Routing `gio@highmuzik.com` → gio.highmuzik@gmail.com (verificata 2026-11-25) · DMARC (Cloudflare DMARC Management, p=none) 2026-11-25
- [x] [C] Resend: dominio highmuzik.com verificato; [G] chiave `highmuzik-site` in `RESEND_API_KEY` (2026-11-25, mail di prova dal form contatti ok) · [ ] [G] chiavi SMTP per Supabase Auth e Gmail
- [x] [C] secrets `MAIL_FROM` = `HIGHMUZIK <gio@highmuzik.com>`, `OFFER_TO`, `RESEND_API_KEY`; Supabase Auth SMTP (sender HIGHMUZIK, gio@highmuzik.com)
- [ ] [G] Gmail "Invia come" `gio@highmuzik.com`, nome HIGHMUZIK (popup che Claude non raggiunge)

**Fase 5 — PR B, dominio nel codice** (dopo fasi 3–4)
- [x] [C] (PR #259; 7 funzioni ridistribuite il 2026-11-25) `site.json` (mediaBaseUrl, liveHosts, legal.email, comingSoon.email; newsletter.action nel PR successivo), `admin.json`, default delle Edge Functions + User-Agent Discogs, commenti; redeploy funzioni (ok di Gio)

**Fase 6 — servizi**
- [x] [C/G] Buttondown: username `highmuzik` (cambia l'endpoint, va insieme a PR B), newsletter name e Author name HIGHMUZIK, email dell'account `gio@highmuzik.com` (= Rispondi a; login resta Google) — fatto 2026-11-25
- [ ] [C/G] dopo il lancio, da valutare: BIMI (logo HM nelle mail di gio@highmuzik.com su Gmail) = record DNS su Cloudflare + certificato VMC/CMC a pagamento + DMARC quarantine/reject. Non fatto il 2026-11-25 (dominio nuovo, costo).
- [ ] [G] AL LANCIO (oggi Stripe è solo sandbox, nessun nome rythem-works): public business name HIGHMUZIK, statement descriptor HIGHMUZIK, support email gio@highmuzik.com
- [x] [C] Discogs developer app: nome HIGHMUZIK, callback https://highmuzik.com/wantlist/ (2026-11-25)
- [x] [C] PostHog: progetto HIGHMUZIK, app_urls highmuzik.com + staging.highmuzik.com (2026-11-25)
- [x] [C] admin → Content: nessun "rythem" nelle 12 pagine di staging dopo la build del 2026-11-25

**Fase 7 — nomi interni e chiusura**
- [x] GitHub: il repo resta `zanza` (Gio 2026-11-25: nome della piattaforma)
- [x] cartella sul Mac e progetto claude.ai restano "Zanza" (piattaforma); [C] artifact DS rigenerato come "HIGHMUZIK Design System" (2026-11-25)
- [ ] [C] quando tutto gira su highmuzik.com: togliere rythem-works.com da Resend, vecchia regola Email Routing, vecchi custom domain

## Rinomina Zanza → rythem-trax (2026-11-14) → rythem-works (2026-11-15)

Il 2026-11-15 tutto quello che nel repo e in Figma diceva rythem-trax è passato a rythem-works (stessi punti elencati qui sotto).

**Fatto**
- Codice: `site.json` → `storeName` = "rythem-works" (header del negozio, `<title>` delle pagine) · nome del DS in `tokens.json`, commenti di `components.css`/`components.js`, titolo dell'artifact in `build-artifact.js`, cover e preview Header · titoli di `CLAUDE.md`, `_context/*`, `design/README.md`, `packages/ui/README.md` · description di `package.json`.
- Buttondown: newsletter name e sender = **rythem-works**, username `rythem-works` (2026-11-15, PR #132). Author name (From) = **RYTHEM-WORKS** dal 2026-11-16.
- Nome mittente di tutte le email = **RYTHEM-WORKS** in maiuscolo (2026-11-16): `MAIL_FROM`, Supabase Auth SMTP, Buttondown, Gmail "Invia come" (elenco in `_context/email-setup.md`).
- Figma: testo dello store name nel component `header` (desktop + mobile, tutte le istanze lo ereditano) e nei 2 header sciolti della pagina PDP; layer testo rinominato `store name`. Lo stile Label lo mostra in maiuscolo (RYTHEM-WORKS).

**Volutamente NON cambiato** (identificatori interni: rinominarli rompe qualcosa o non si vede; si fa solo se Gio lo chiede)
- Repo GitHub `giovannidufour/zanza`, cartella sul Mac, `package.json` → `"name": "zanza"`.
- Namespace JS `window.Zanza`, `ZanzaToast`, `ZanzaShipping` (admin, negozio, preview).
- Chiavi localStorage `zanza-bag`, `zanza-ship-to`: rinominarle svuota il bag ai visitatori (serve una migrazione della chiave).
- `site.json` `outputDir`/`basePath` `zanza` e `deploy.json` (staging GoDaddy legacy, URL gio-d.xyz/zanza).
- Decisioni in `design/decisions/` (append-only: restano col nome dell'epoca).
- Supabase `store-staging`, Pages `store-front`/`store-admin`, bucket `store-media`: nomi già neutri.

**Dominio definitivo (2026-11-15):** Gio ha comprato **`rythem-works.com`** (Cloudflare Registrar). Email del negozio: **`gio@rythem-works.com`** (Email Routing → Gmail). Collegati: apex + `www` = pagina coming soon (PR #131), negozio su `staging.` dietro Cloudflare Access, `admin.`, `media.` (R2), CORS R2, DMARC, Resend verificato, secret Supabase aggiornati, chiave Resend nuova, "Invia come" nella casella del negozio, Buttondown (username + endpoint, PR #132). Mappa in `_context/stack.md` → Dominio. Ancora da fare: inoltro email verso la casella del negozio (Cloudflare non manda la verifica), `siteUrl` (PR #106 SEO non ancora unita), poi le righe sotto.

**Da fare fuori dal repo** (servono le mani o l'ok di Gio)
- Figma: rinominare il file "Zanza - Record Store" (l'API non può; la key non cambia).
- claude.ai: progetto "Zanza" e artifact "Zanza Design System" (va rigenerato con `npm run build:artifact` per avere il titolo nuovo).
- Stripe public details (nome e email pubblica = rythem-works, gio@rythem-works.com) prima del live.
- Logo: illustrazione `logo.png` (tenuta come ricordo, non usata; Figma `logo illustration`) sostituita il 2026-11-25 dal wordmark HIGHMUZIK (`Logo` in packages/ui, Figma `logo`) e dal monogramma HM nei favicon (decisione 0183).

## Pagine legali: segnaposto (2026-11-14, ridotte il 2026-11-15, decisioni 0079 e 0093)

Gio vende da privato (2026-11-15): niente Impressum, niente indirizzo, niente telefono, niente riga IVA; contatto = email + form (`/contact/`, funzione Supabase `contact`, che scrive a CONTACT_TO o OFFER_TO = email personale di Gio). La build elenca tutto quello che manca.

| Dove | Segnaposto | Stato |
|---|---|---|
| `site.json` → legal: name, email | name: nessun nome in Privacy (scelta di Gio 2026-11-22, rischio accettato, decisione 0130); email = gio@rythem-works.com, si vede su /contact/ e in Privacy | 🟢 scelta consapevole |
| `site.json` → contact.endpoint | vuoto finché la funzione `contact` non è deployata: il form rimanda all'email | 🟡 |
| `shipping.md` → When it arrives | spedizione: almeno una volta a settimana, di solito mercoledì (Gio 2026-11-22, decisione 0133) 🟢 · consegna: "dipende dal corriere e dalla destinazione", senza numeri (decisione 0134) | 🟢 |
| Scelta di fondo | venditore privato (0093): niente recesso né garanzia oltre la descrizione | 🟡 da confermare con commercialista o avvocato |

## Account di servizi (email personale di Gio)

| Servizio | Cosa usa nome/email | Dove si cambia | Cambio |
|---|---|---|---|
| Buttondown (newsletter, 2026-11-12) | login con Google (Gmail personale) · **email dell'account = `gio@rythem-works.com`** (2026-11-15: Buttondown la usa come "Rispondi a", prima mostrava il Gmail personale agli iscritti) · **username `rythem-works`** (era `dufour`, cambiato da Gio il 2026-11-15) → pagina pubblica `buttondown.com/rythem-works` ed endpoint del form `https://buttondown.com/api/emails/embed-subscribe/rythem-works` · newsletter name "rythem-works", sender (Author name, From) "RYTHEM-WORKS" (2026-11-16; prima "rythem-works", e fino al 2026-11-15 rythem-trax) · l'endpoint è in `site.json` → `newsletter.action` (form del footer, attivo dal 2026-11-14) · Mailing address = indirizzo di casa di Gio: **non deve mai comparire nelle mail** (compare solo se il footer contiene `{{ newsletter.address }}`; prova di invio a sé prima del primo numero) | Settings → General (username, nome) · Settings → Email (sender, mailing address) · Account (email login) | 🟡 username: cambia l'URL pubblico e l'endpoint del form nel codice |
| PostHog (analytics, 2026-11-22, decisione 0131) | login con la Gmail personale di Gio · regione EU · progetto 362828 (nome "Default project") · dominio web analytics `https://rythem-works.com`, heatmap su `https://rythem-works.com/`, `/sale/*`, `/products/*` · token in `site.json` → `analytics.key` | Settings → Project (nome), Web analytics (dominio), Heatmaps (URL) | 🟢 dominio/URL nei settings; 🔴 token legato al progetto |
| YouTube (canale dei video dei dischi, 2026-11-25) | canale **HIGHMUZIK**, handle **`@highmuzik`**, id `UCwaoyjMAI--aB4rpAHhmHxA` (canale "High Muzik" che Gio aveva già creato, rinominato il 2026-11-25) · Brand Account sotto la Gmail personale di Gio (login personale, il pubblico vede solo HIGHMUZIK; sullo stesso account anche "Giovanni Dufour" e "Version Entry") · descrizione vuota (Gio 2026-11-25: per ora niente), link Shop https://highmuzik.com, email di contatto `gio@highmuzik.com` · avatar HM su verde #73ff61 e banner 2048×1152 in `highmuzik-brand/` · **se cambia il verde del brand: aggiornare anche avatar e banner qui** (con favicon e avatar Gmail) | YouTube Studio → Personalizzazione (nome 2 volte ogni 14 giorni, handle idem) | 🟢 nome/immagini; 🟡 handle (cambia l'URL pubblico) |
| Resend (email transazionali, 2026-11-12) | login con l'email Google personale · dominio di invio **`rythem-works.com`** (eu-west-1; `gio-d.xyz` e chiave `zanza-notify` rimossi il 2026-11-15) · chiavi `rythem-works-site`, `gmail-smtp-3` | Dashboard Resend → Domains (nuovo dominio + DNS); runbook completo in `_context/email-setup.md` | 🟡 nuovo dominio = nuovi record DNS e verifica |
| Supabase Edge Functions (secrets) | `MAIL_FROM` "RYTHEM-WORKS <gio@rythem-works.com>" (maiuscolo dal 2026-11-16) · `STORE_NAME` "rythem-works" · `SHOP_URL` https://rythem-works.com · `OFFER_TO` gio.rythem.works@gmail.com (2026-11-15) — nulla hard-coded nel repo | Dashboard → Edge Functions → Secrets (vedi `_context/email-setup.md`) | 🟢 |
| Supabase | org "Gios", progetto `store-staging` (nome neutro), login con email personale · Auth Site URL / redirect = URL admin | Dashboard → Organization / Auth → URL configuration | 🟢 nomi · 🟡 email di login |
| Cloudflare (R2 + Pages + Access + Email Routing) | account di gio-d.xyz e rythem-works.com (email personale) · Pages `coming-soon` (apex + www fino al lancio) · Zero Trust team `rythem-works`, app Access `staging` · Email Routing `gio@` → casella del negozio · bucket `store-media`, Pages `store-front` / `store-admin` (nomi neutri) · URL `*.pages.dev`, `pub-…r2.dev` | Dashboard; dominio custom al posto dei `*.pages.dev` / `r2.dev` | 🟡 al cambio dominio (vedi `stack.md` → Portabilità) |
| Stripe | account `acct_1RGEAj2LZr7JToM4`, email personale, nome pubblico del business da impostare | Settings → Business / Public details | 🟢 prima di attivare il live |
| GitHub | repo `giovannidufour/zanza` | Settings → Rename (GitHub reindirizza il vecchio URL) | 🟡 aggiornare remote sul Mac e i link nei docs |
| Figma | file "Zanza - Record Store" (key `X9aI5cZ8UF3T2fskPdUChY`, la key non cambia) | Rinomina file | 🟢 |
| claude.ai | progetto "Zanza", artifact "Zanza Design System" | Rinomina | 🟢 |

## Codice e repo

| Dove | Cosa | Cambio |
|---|---|---|
| `package.json`, `package-lock.json` | `"name": "zanza"`, description | 🟢 |
| `packages/ui/tokens.json` | `"name": "Zanza"` | 🟢 |
| `packages/ui/components.js`, `toast.js` | namespace globali `window.Zanza`, `window.ZanzaToast` (usati da admin, storefront, preview) | 🟢 ricerca/sostituzione, ma tutto in un commit |
| `packages/ui/*.css`, `build-artifact.js`, docs | "Zanza" nei commenti e nel titolo dell'artifact DS | 🟢 |
| `apps/storefront/site.json` | `storeName` (ancora "Store-name"), `outputDir`/`basePath` `zanza` (solo staging GoDaddy) | 🟢 |
| `apps/storefront/deploy.json` | `remoteDir /public_html/zanza`, `publicUrl gio-d.xyz/zanza` (legacy) | 🟢 |
| `apps/storefront/scripts/site.js` | chiave localStorage **`zanza-bag`** | 🟡 rinominarla svuota il bag a chi ce l'ha: migrare la vecchia chiave |
| `CLAUDE.md`, `_context/*`, `design/*` | nome del progetto nei testi | 🟢 |

## Email e testi che vedono i clienti

| Dove | Cosa | Cambio |
|---|---|---|
| Mittente email transazionali (Resend) | nome e indirizzo mittente (`MAIL_FROM`, `STORE_NAME` nei secrets, vedi sopra) | 🟢 config (`stack.md` → Portabilità) |
| Newsletter (Buttondown) | sender name, mailing address/Impressum nel footer delle mail | 🟢 |
| Pagine legali (2026-11-14, decisione 0079) | nome del negozio da `site.json` → storeName; **email di contatto, nome legale, indirizzo, telefono** in `site.json` → legal (vuoti, li inserisce Gio); provider elencati in `content/legal/privacy.md` (Cloudflare, Supabase, Resend, Buttondown, Stripe, Discogs, Meta) | 🟢 testo/config; al cambio email aggiornare `legal.email` |

## Al cambio nome: ordine consigliato
1. Dominio + email del negozio → 2. login dei servizi sulla nuova email → 3. username Buttondown + endpoint nel codice → 4. config (`site.json`, `admin.json`, URL Supabase/Stripe/R2) → 5. ricerca `zanza` / `Zanza` nel repo → 6. GitHub, Figma, claude.ai.

_Last updated: 2026-11-15_
