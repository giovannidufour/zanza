# Email transazionali (Resend) — runbook

Come sono configurate le email del negozio e **come rifare tutto da zero** con nome, dominio o email nuovi (il nome "Zanza" e il dominio sono provvisori). Prima email in uso: **Notify me** (decisione 0059, migrazione 0016, funzione `notify-back-in-stock`). Le prossime (conferma ordine) useranno lo stesso account e dominio.

## Stato attuale (2026-11-12)

| Cosa | Valore oggi | Provvisorio? |
|---|---|---|
| Account Resend | login Google con l'email personale di Gio | sì (email) |
| Dominio di invio | `gio-d.xyz` (DNS su Cloudflare, regione Resend **eu-west-1**) | sì |
| Mittente (`MAIL_FROM`) | `Zanza <shop@gio-d.xyz>` | sì (nome + indirizzo) |
| Nome nel testo (`STORE_NAME`) | `Zanza` | sì |
| Link nel testo (`SHOP_URL`) | `https://store-front-6fx.pages.dev` | sì (dominio Pages) |
| Tracking aperture/click | spento (privacy) | — |
| Ricezione email | spenta | — |

Nessun nome, dominio o indirizzo è scritto nel codice: stanno tutti nei secrets della funzione. Il codice va toccato solo se cambia il testo dell'email.

**Stato:** attivo e provato il 2026-11-12 (email consegnata a `delivered@resend.dev`, l'inbox di test di Resend).

## Pezzi e dove stanno

1. **Resend** → Domains: il dominio con 3 record DNS (sotto). → API keys: una chiave `zanza-notify`, *Sending access*, solo sul dominio.
2. **Cloudflare** → DNS del dominio: i 3 record di Resend (*DNS only*, non proxied).
3. **Supabase** (`store-staging`) → Edge Functions → `notify-back-in-stock`: *Verify JWT* **off** (la chiama un job senza login; il controllo è `NOTIFY_SECRET`).
4. **Supabase** → Edge Functions → Secrets: `RESEND_API_KEY`, `NOTIFY_SECRET`, `MAIL_FROM`, `SHOP_URL`, `STORE_NAME`.
5. **Supabase** → Integrations → Vault → *Add new secret* (form, più semplice dell'SQL): `notify_back_in_stock_url` (URL della funzione) e `notify_back_in_stock_secret` (= `NOTIFY_SECRET`).
6. **pg_cron** job `back-in-stock` (migrazione 0016): ogni minuto, chiama la funzione solo se c'è una richiesta dovuta.
7. **Permessi** (migrazione 0017): questo progetto non dà permessi sulle tabelle a `service_role` di default; la funzione ha bisogno di select/update/delete su `back_in_stock` e select su `listings`, `releases`, `release_lines`. Senza: `permission denied for table back_in_stock`.

### Record DNS (gio-d.xyz, regione eu-west-1)
| Tipo | Nome | Contenuto |
|---|---|---|
| TXT | `resend._domainkey` | chiave DKIM data da Resend (`p=MIGf…`; cambia per ogni dominio) |
| CNAME | `rsend` | `rsend-euw1.forge.rmta.net` |
| CNAME | `send` | `send.forge.rmta.net` |

## Rifare tutto con nome / dominio / email nuovi

Chi fa cosa: i passi marcati **(Gio)** toccano chiavi, segreti, DNS o login e li fa Gio (Claude li prepara e guida); il resto lo fa Claude dal browser.

1. **(Gio)** Account Resend nuovo, o cambia l'email del vecchio in Settings → Team.
2. Resend → Domains → **Add domain**: il nuovo dominio, *Advanced options* → Region **Ireland (eu-west-1)**, tracking spento.
3. **(Gio)** DNS: **Auto configure** (Domain Connect, autorizza su Cloudflare) oppure *Manual setup* e i 3 record nella zona. Poi **Verify DNS records**.
4. **(Gio)** Resend → API keys → **Create**: *Sending access*, solo il nuovo dominio. Incollala in Supabase Secrets come `RESEND_API_KEY`. Cancella la vecchia chiave.
5. Supabase Secrets: aggiorna `MAIL_FROM` (`Nuovo nome <indirizzo@nuovo-dominio>`), `STORE_NAME`, `SHOP_URL` (dominio del negozio).
6. Se cambia anche il progetto Supabase: rideploya `notify-back-in-stock` (Verify JWT off), **(Gio)** nuovo `NOTIFY_SECRET` + Vault `notify_back_in_stock_secret` e `notify_back_in_stock_url` (SQL in fondo a `supabase/migrations/20261112010000_back_in_stock.sql`).
7. Prova senza toccare i dischi: dall'SQL editor `insert into back_in_stock (listing_id, email) select id, 'delivered@resend.dev' from listings where status = 'available' limit 1;` → entro ~1 minuto la riga sparisce e l'email compare in Resend → Emails. Se no: `select status_code, content from net._http_response order by created desc limit 5;` e `back_in_stock.last_error`. Prova completa: copia in *Reserved* dall'admin, Notify me con la tua email, rilasciala.
8. Vecchio dominio: togli i 3 record DNS e rimuovi il dominio da Resend.
9. Se rifai il progetto Supabase: applica anche la 0017 (permessi).
10. Aggiorna questa tabella e il registro dei nomi provvisori.

## Note
- Piano gratuito Resend: 3.000 email/mese, 100/giorno.
- Il testo dell'email (oggetto "It's back: …") è in `supabase/functions/notify-back-in-stock/index.ts`; l'indirizzo viene cancellato dopo l'invio, e il testo lo dice.
- Datenschutz: le pagine legali (passo 4 del piano) devono citare Resend come responsabile del trattamento per queste email.
