# Nomi ed email provvisori — registro

> "Zanza" è un nome provvisorio (Q7) e gli account usano l'email personale di Gio.
> Quando arrivano il nome definitivo e l'email del negozio, questa è la lista di **tutto** quello da aggiornare.
> **Regola:** ogni volta che un thread usa il nome, l'email o un identificativo legato a loro (account, username, URL, chiave localStorage…), aggiunge una riga qui nello stesso commit.

Legenda colonna *Cambio*: 🟢 facile (testo/config) · 🟡 da pianificare (URL pubblici, dati utente, redirect) · 🔴 difficile o impossibile (identificativo fisso: si crea un nuovo account/progetto).

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
| Pagine legali (Impressum, Datenschutz…, da fare) | nome del negozio, email di contatto, provider elencati | 🟢 |

## Al cambio nome: ordine consigliato
1. Dominio + email del negozio → 2. login dei servizi sulla nuova email → 3. username Buttondown + endpoint nel codice → 4. config (`site.json`, `admin.json`, URL Supabase/Stripe/R2) → 5. ricerca `zanza` / `Zanza` nel repo → 6. GitHub, Figma, claude.ai.

_Last updated: 2026-11-12_
