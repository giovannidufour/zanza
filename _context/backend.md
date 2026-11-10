# Zanza — Backend (bozza v0, 2026-11-09)

Stack: `stack.md`. Questa è la **bozza** dello schema e dei flussi, da rivedere prima della prima migrazione. Nomi DB in inglese.

## Principi
1. **Il contratto è lo schema JSON di oggi** (`apps/storefront/content/products/*.json`: `listing / release / copy / samples`). Il DB può essere normalizzato diversamente, ma `build.js` riceve esattamente quella forma → le pagine non cambiano.
2. **Una copia = un listing.** Con copie sempre uniche, `copy` e `listing` del brief diventano **una tabella** (`listings`). Nel JSON restano due oggetti separati, li divide il mapping.
3. **Release separata dalla copia.** Cover, tracklist e sample appartengono alla pressatura: se ricompri lo stesso disco, il sample registrato si riusa.
4. **Nel DB solo chiavi di storage**, mai URL. `media_base_url` sta in configurazione.
5. **Soldi in centesimi interi** (`price_cents`), mai float.

## Tabelle

**Fonte di verità: `supabase/migrations/`** (`0001` init 2026-11-09, `0002` listing form 2026-11-10, `0003` `admin_save_listing` 2026-11-10, `0004` stati di vendita e `0005` ricostruzione del sito 2026-11-10, … `0009` archivio, delete e bulk, `0010` delete di qualsiasi copia, … `0012` grading per lato; applicate dall'editor SQL di Supabase). Qui solo il riassunto:

| Tabella | Cosa | Note |
|---|---|---|
| `grades` | scala di Gio (Q8): `M, NM, NM-, EX+, EX, EX-, VG+, VG, VG-, G+, G, G-, F` | `rank` 1 = migliore → filtri "da VG+ in su" |
| `releases` | la pressatura | label, paese, anno, formato, `genre`/`style` text[] (style = "Tags" nell'admin) |
| `release_lines` | artista/titolo per lato (riga 1 = lato A…), dal form "Create listing" | artista vuoto = stesso della riga 1 (non mostrato). Nome mostrato: `custom_title`, altrimenti "Artist - Title 1 / Title 2" (o "Artist 1 - Title 1 / Artist 2 - Title 2") |
| `tags`, `release_tags` (0007) | tag (= styles Discogs) come entità con `slug` (filtri PLP futuri), in ordine per release | `releases.style` resta = i nomi dei tag, così il negozio non cambia |
| `artists`, `labels` (0006) | entità con nome **ufficiale**, `slug` (pagina futura), id Discogs | `artist_aliases` / `label_aliases` = altre grafie. Le righe le collegano con `release_line_artists` (più artisti per riga, in ordine, con "&"/"feat."); la release con `label_id`. `release_lines.artist` e `releases.label` restano = il **credito come stampato** su quel disco (lo mostra il negozio) |
| `listings` | la copia pubblicata (copy + listing del brief) | `section`, `status`, `price_cents`, `condition_media` (lato A) + `condition_media_b` (lato B, facoltativo, 0012) → `grades`, `sleeve_type` (`original`/`generic`/`none`) + `condition_sleeve` → `grades`, `photo_keys[]` (la **prima è la featured/cover**), `sku` (automatico), `custom_title`, `condition_notes`, `reserved_until`, `import_source` (solo test) |
| `samples` | clip della release | `audio_key`, `line_id` (sample del lato; vuoto = "additional"), `sort` = ordine nel player |
| `orders`, `order_items` | ordini Stripe | li scrivono solo le Edge Functions; prezzo copiato al momento dell'acquisto |
| `admins` | l'operatore (Gio) | riga aggiunta a mano dopo la registrazione all'admin |

Rimandato (con il Trade, Q2): `proposals`, `proposal_messages`. Preferiti/account: non nell'MVP.

**Dati di prova:** `supabase/scripts/build-seed.js` genera `supabase/seed.sql` (upsert, id derivati dallo slug) dai 21 JSON di `content/products/`. Le immagini e i sample di prova restano URL assoluti verso il negozio di origine: è l'unica eccezione alla regola "solo chiavi".

## Sicurezza (RLS)
- **Pubblico (anon):** lettura di `releases`, `samples` e dei `listings` con `status <> 'draft'`.
- **Admin:** un solo utente Supabase Auth (Gio), presente in `admins`; `is_admin()` nelle policy. Niente ruoli.
- Nel progetto le tabelle nuove **non** sono esposte in automatico: ogni migrazione dichiara i suoi `grant`.
- **Ordini:** nessun accesso pubblico; li scrivono solo le Edge Functions (service role).

## Storage (R2)
```
photos/<uuid>.webp     (foto del listing, la prima è la featured)
samples/<uuid>.mp3     (sample; lato e ordine stanno nel DB)
```
Chiavi casuali e immutabili (2026-11-10): l'upload avviene prima che il listing esista, e un file non viene mai sovrascritto (cache sicura).
- L'upload va dall'admin **direttamente su R2** con un URL firmato rilasciato da una Edge Function (`sign-upload`, solo per l'admin).
- Immagini ridimensionate nel browser prima dell'upload (webp, lato lungo ~1600 px). *Le dimensioni effettive dipendono dal design PDP: da Figma.*
- Sample: mp3 128 kbps, 30–60 s, già tagliati da Gio (es. Audacity). Tagliarli dentro l'admin si può aggiungere dopo.

## Flussi

### Creare un listing (admin)
1. **Fetch Discogs** (2026-11-10, Figma 2103:20718): incolli link o numero della release in "Discogs match" → il pulsante chiama l'Edge Function `discogs-lookup` (solo admin, User-Agent proprio, token opzionale `DISCOGS_TOKEN` nei secret; niente cache, ToU 6 h) e riempie **solo i campi della release**: righe artista/titolo (una per traccia; artista vuoto se uguale alla riga 1), label, cat. no (non mostrato, salvato), anno, paese, formato, genere (il primo), tag (= styles). Prezzo, condizioni, note, foto e sample restano; i sample di righe sparite diventano "additional". Valori fuori dai vocabolari del form (paese, formato, altri generi) vengono elencati nel messaggio, non inventati. Foto Discogs: non importate (diritti). La ricerca per testo (serve il token) arriverà nella stessa funzione.
2. Condizione, prezzo, note, foto, sample.
3. Salva = **una chiamata** a `admin_save_listing(payload)` (una transazione: release, righe, listing, sample). `draft` → **Pubblica** = `available` + `published_at`; poi ricostruzione del sito.
4. Copertina: il grado è ammesso per busta `original` e `generic`, mai per `none` (0003).

### Artisti ed etichette (0006, Gio 2026-11-10)
- Nel form (decisione DS 0020, 2026-11-10): Artist, Label e Tags sono campi a **chips** (`EntityField`): ogni chip è un'entità, il testo che non diventa chip non si salva. Menu: entità esistenti, alias "grafia → ufficiale", "Create …". Artist e Tags più chips (gli artisti di una riga si uniscono con "&"), Label una. Checkbox "Different spelling" → compare il campo "Artist name on label" / "Label spelled on record" = grafia sul disco.
- Al salvataggio (`admin_save_listing`) il collegamento: id scelto → id Discogs → nome o alias (maiuscole indifferenti, vince il più vecchio) → entità nuova. Una grafia diversa dall'ufficiale diventa alias in automatico.
- Fetch Discogs passa nome ufficiale, ANV (come stampato) e id Discogs dell'artista/label; con più artisti su una traccia arriva una chip per artista, ognuna col suo id Discogs. Il credito come stampato diventa alias solo se la riga ha un solo artista.
- Pre-release (0008): `releases.pre_release` (boolean, della pressatura, non dell'etichetta): checkbox "Pre-release" sotto Label; il negozio scrive "Pre" dopo il nome della label.
- Tag (0007): stesso collegamento per nome (senza alias né id Discogs); il salvataggio riscrive `releases.style` con i nomi dei tag in ordine.
- Dati esistenti: un'entità per nome distinto (i 21 dischi di prova hanno nomi combinati tipo "A & B" in maiuscolo: da sistemare a mano se servono).

### Stati di vendita (0004)
```
draft ──► available ──► reserved ──► sold (sale) / traded (trade)
  ▲          │  ▲           │                │
  └──────────┘  └───────────┴────────────────┘   unpublish · release · annulla vendita
available ──► sold / traded diretto (venduto fuori dal sito: fiera, Discogs, di persona)
```
- **Cambio manuale = `admin_set_status(listing, status, note)`**: solo le transizioni sopra, altrimenti errore. Il form continua a fare solo draft ⇄ available e non annulla mai una vendita (0003).
- `sold` solo per la sezione sale, `traded` solo per trade (vincoli nel DB).
- **Hold manuale** (riservato per qualcuno): `reserved`, `reserved_until` vuoto = finché Gio non lo rilascia.
- **Hold del checkout**: `reserved` + `reserved_until` + `stripe_session_id`. Finché è attivo, l'admin non può cambiare lo stato (evita la doppia vendita). **Scaduto = disponibile** (`effective_status()`), anche se il webhook `expired` non arriva mai.
- **Storico:** `listing_status_log` registra ogni cambio (chi, quando, nota), da qualunque parte arrivi (form, admin, Edge Functions).
- **Lettura pubblica dal vivo:** vista `listing_availability` (id, slug, section, status effettivo), bozze escluse. La userà `site.js`.

### Archiviare ed eliminare (0009–0010, Gio 2026-11-10)
- **Elimina** = hard delete di qualsiasi copia (0010, Gio 2026-11-10), tranne quelle con un ordine (gli ordini sono registri contabili: archiviale) o con un checkout in corso (`admin_delete_listings`). Va via anche la release se nessun'altra copia la usa. Le chiavi media finiscono in `media_trash`. Ogni azione bulk chiede conferma.
- **Archivia** = stato `archived`, il modo reversibile: fuori dal negozio (RLS) e dalla lista di default dell'admin, storico e ordini restano. `archived_from` ricorda lo stato di prima; **Restore** lo riporta lì. Una copia archiviata è in sola lettura: form e `admin_set_status` non la muovono (trigger `guard_archived`).
- **Bulk** = `admin_bulk_status(ids, publish | unpublish | archive | restore)`, una transazione; ogni copia passa solo se la transizione è ammessa, le altre tornano in `skipped`. L'admin offre Undo (azione inversa sugli id cambiati).
- **Pulizia R2**: `media_trash` raccoglie anche le foto tolte nel form e i sample rimossi o sostituiti. La Edge Function `purge-media` (chiamata dall'admin all'apertura di Listings) cancella da R2 solo le chiavi in cestino da più di 7 giorni e non più usate da nessun listing o sample. Gli upload abbandonati prima del salvataggio non sono nel DB: restano su R2.

### Checkout con hold
1. Il sito chiama `create-checkout` con gli id dei listing.
2. Update atomico: `status = 'reserved', reserved_until = now() + 30 min` **solo se** `available` (o se l'hold è scaduto). Se una copia non passa → "appena venduto", niente sessione.
3. Crea la sessione Stripe Checkout (`expires_at` = 30 min, il minimo di Stripe; righe con il prezzo letto dal DB, mai quello inviato dal client; tariffe di spedizione per zona).
4. Webhook `checkout.session.completed` → `orders` + `order_items`, listing `sold`, email Resend.
5. Webhook `checkout.session.expired` → listing di nuovo `available`.

### Stato dal vivo sul sito statico
Le pagine sono statiche, ma "sold/reserved" non può aspettare una ricostruzione: `site.js` legge gli stati da Supabase (una query per pagina, sola lettura) e aggiorna CTA e badge.

### Pubblicazione (0005, scelta di Gio 2026-11-10)
- Negozio su **Cloudflare Pages** collegato al repo GitHub: build `npm run build:pages` (`--target=pages`: sito alla radice, dati solo da Supabase), output `apps/storefront/dist`, variabili `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`.
- Un cambio a un listing pubblico (o che diventa / smette di essere pubblico) segna `site_build.pending`. Un job `pg_cron` ogni minuto chiama **una volta** il deploy hook di Pages (via `pg_net`) → negozio aggiornato in ~2 min. Le bozze e gli hold del checkout non ricostruiscono.
- L'URL del deploy hook sta nel **Vault** di Supabase (`pages_deploy_hook`), mai nel repo. Stato e ultimo errore: tabella `site_build`.
- Un push su `main` ricostruisce anche lui (codice nuovo).
- **Attivo e verificato 2026-11-10:** progetto Pages `store-front` → https://store-front-6fx.pages.dev (variabili `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `NODE_VERSION=20`), deploy hook `supabase-catalogue` (branch `main`); prova: `site_build.pending` → job → hook 200 → nuovo deploy.
- GoDaddy (`npm run build:deploy`) resta solo come staging di riserva.

## Prossimi passi
1. Gio: creare gli account Supabase, Cloudflare (R2) e Stripe (test mode). Le chiavi vanno in un `.env` git-ignored, mai in chat.
2. ~~Prima migrazione SQL + import dei 21 JSON di test~~ ✅ 2026-11-09.
3. ~~`build.js` legge da Supabase (fallback ai JSON in locale)~~ ✅ 2026-11-09: `apps/storefront/data/products.js`, API REST pubblica con la publishable key; output identico ai JSON.
4. Gio: design in Figma del flusso "crea listing" nell'admin.
5. Checkout: dopo il chiarimento fiscale (Q5b).

_Last updated: 2026-11-10 (Fetch Discogs: Edge Function `discogs-lookup`)_
