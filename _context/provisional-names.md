# Nomi ed email provvisori — registro

> Il nome provvisorio era "Zanza". **Dal 2026-11-14 lo store si chiama `rythem-trax`** (grafia di Gio: *rythem*, non *rhythm*; minuscolo, col trattino; ancora "forse", dominio e marchio da verificare, Q7). Gli account usano ancora l'email personale di Gio.
> Questa è la lista di **tutto** quello che porta il nome o l'email: la sezione sotto dice cosa è già passato a rythem-trax e cosa no.
> **Regola:** ogni volta che un thread usa il nome, l'email o un identificativo legato a loro (account, username, URL, chiave localStorage…), aggiunge una riga qui nello stesso commit.

Legenda colonna *Cambio*: 🟢 facile (testo/config) · 🟡 da pianificare (URL pubblici, dati utente, redirect) · 🔴 difficile o impossibile (identificativo fisso: si crea un nuovo account/progetto).

## Rinomina Zanza → rythem-trax (2026-11-14)

**Fatto**
- Codice: `site.json` → `storeName` = "rythem-trax" (header del negozio, `<title>` delle pagine) · nome del DS in `tokens.json`, commenti di `components.css`/`components.js`, titolo dell'artifact in `build-artifact.js`, cover e preview Header · titoli di `CLAUDE.md`, `_context/*`, `design/README.md`, `packages/ui/README.md` · description di `package.json`.
- Figma: testo dello store name nel component `header` (desktop + mobile, tutte le istanze lo ereditano) e nei 2 header sciolti della pagina PDP; layer testo rinominato `store name`. Lo stile Label lo mostra in maiuscolo (RYTHEM-TRAX), come prima.

**Volutamente NON cambiato** (identificatori interni: rinominarli rompe qualcosa o non si vede; si fa solo se Gio lo chiede)
- Repo GitHub `giovannidufour/zanza`, cartella sul Mac, `package.json` → `"name": "zanza"`.
- Namespace JS `window.Zanza`, `ZanzaToast`, `ZanzaShipping` (admin, negozio, preview).
- Chiavi localStorage `zanza-bag`, `zanza-ship-to`: rinominarle svuota il bag ai visitatori (serve una migrazione della chiave).
- `site.json` `outputDir`/`basePath` `zanza` e `deploy.json` (staging GoDaddy legacy, URL gio-d.xyz/zanza).
- Decisioni in `design/decisions/` (append-only: restano col nome dell'epoca).
- Supabase `store-staging`, Pages `store-front`/`store-admin`, bucket `store-media`: nomi già neutri.

**Da fare fuori dal repo** (servono le mani o l'ok di Gio)
- Figma: rinominare il file "Zanza - Record Store" (l'API non può; la key non cambia).
- claude.ai: progetto "Zanza" e artifact "Zanza Design System" (va rigenerato con `npm run build:artifact` per avere il titolo nuovo).
- Supabase → Edge Functions → Secrets: `STORE_NAME` = rythem-trax e `MAIL_FROM` col nuovo nome (oggi "Zanza", lo vedono i clienti nelle email Notify me e nelle email di offerta).
- Buttondown: newsletter name e sender "Zanza" → rythem-trax; username `dufour` resta finché non c'è un account del negozio.
- Dominio + email del negozio (es. rythem-trax.*): da comprare/verificare; poi Resend, Cloudflare Pages custom domain, `SHOP_URL`, Stripe public details. Ordine in fondo a questo file.
- Logo (`apps/storefront/public/logo.png`, illustrazione): non contiene il nome, non toccato.

## Pagine legali: segnaposto (2026-11-14, decisione 0079)

Gio (2026-11-14): "fai tutto tu per ora, metti dei placeholder". Online ci sono questi valori **provvisori**: vanno confermati o sostituiti da Gio, e i testi rivisti da un avvocato o un generatore (eRecht24, IT-Recht Kanzlei). La build li elenca tutti (`to fill:` per ogni pagina).

| Dove | Segnaposto | Stato |
|---|---|---|
| `site.json` → legal: name, street, postcode, city, email, phone | mostrati tra parentesi quadre ("[Your full name]"…): dati personali, Claude non li inventa | 🔴 servono a Gio prima di vendere (Impressum obbligatorio, § 5 DDG) |
| `site.json` → legal.vat + `terms.md` § 3 | "[VAT line…]", "[TO FILL: VAT note…]" | 🔴 dipende da Q5b (commercialista) |
| `privacy.md` → Trade offers | offerte senza scambio cancellate dopo "6 months" | 🟡 proposta di Claude |
| `privacy.md` → Orders | corriere "Deutsche Post / DHL" | 🟡 da confermare |
| `privacy.md` → Your rights | autorità di controllo "Berliner Beauftragte für Datenschutz und Informationsfreiheit" (vale se Gio risiede a Berlino) | 🟡 |
| `shipping.md` → When it arrives | spedizione entro "3 working days", consegna "Germany 1–3 working days, EU 3–7, rest of the world 7–21" | 🟡 |
| Scelta di fondo | testi scritti come venditore Unternehmer (recesso 14 giorni, garanzia legale): scelta di Claude, card chiusa così su "fai tutto tu" | 🟡 |

## Account di servizi (email personale di Gio)

| Servizio | Cosa usa nome/email | Dove si cambia | Cambio |
|---|---|---|---|
| Buttondown (newsletter, 2026-11-12) | login = email personale · **username `dufour`** → pagina pubblica `buttondown.com/dufour` ed endpoint del form `https://buttondown.com/api/emails/embed-subscribe/dufour` · newsletter name "Zanza" · sender (From) "Zanza" | Settings → General (username, nome) · Settings → Email (sender, mailing address) · Account (email login) | 🟡 username: cambia l'URL pubblico e l'endpoint del form nel codice |
| Resend (email transazionali, 2026-11-12) | login con l'email Google personale · dominio di invio **`gio-d.xyz`** (regione eu-west-1) con 3 record DNS su Cloudflare: `resend._domainkey` TXT, CNAME `rsend` e `send` | Dashboard Resend → Domains (nuovo dominio + DNS); runbook completo in `_context/email-setup.md` | 🟡 nuovo dominio = nuovi record DNS e verifica |
| Supabase Edge Function `notify-back-in-stock` (secrets) | `MAIL_FROM` "Zanza <shop@gio-d.xyz>" (proposto, non ancora confermato da Gio) · `STORE_NAME` "Zanza" · `SHOP_URL` https://store-front-6fx.pages.dev — nulla hard-coded nel repo | Dashboard → Edge Functions → Secrets (vedi `_context/email-setup.md`) | 🟢 |
| Supabase | org "Gios", progetto `store-staging` (nome neutro), login con email personale · Auth Site URL / redirect = URL admin | Dashboard → Organization / Auth → URL configuration | 🟢 nomi · 🟡 email di login |
| Cloudflare (R2 + Pages) | account di gio-d.xyz (email personale) · bucket `store-media`, Pages `store-front` / `store-admin` (nomi neutri) · URL `*.pages.dev`, `pub-…r2.dev` | Dashboard; dominio custom al posto dei `*.pages.dev` / `r2.dev` | 🟡 al cambio dominio (vedi `stack.md` → Portabilità) |
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

_Last updated: 2026-11-14_
