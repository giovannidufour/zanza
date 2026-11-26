# rythem-works — Backend (bozza v0, 2026-11-09)

Stack: `stack.md`. Questa è la **bozza** dello schema e dei flussi, da rivedere prima della prima migrazione. Nomi DB in inglese.

## Principi
1. **Il contratto è lo schema JSON di oggi** (`apps/storefront/content/products/*.json`: `listing / release / copy / samples`). Il DB può essere normalizzato diversamente, ma `build.js` riceve esattamente quella forma → le pagine non cambiano.
2. **Una copia = un listing.** Con copie sempre uniche, `copy` e `listing` del brief diventano **una tabella** (`listings`). Nel JSON restano due oggetti separati, li divide il mapping.
3. **Release separata dalla copia.** Cover, tracklist e sample appartengono alla pressatura: se ricompri lo stesso disco, il sample registrato si riusa.
4. **Nel DB solo chiavi di storage**, mai URL. `media_base_url` sta in configurazione.
5. **Soldi in centesimi interi** (`price_cents`), mai float.

## Tabelle

**Fonte di verità: `supabase/migrations/`** (`0001` init 2026-11-09, `0002` listing form 2026-11-10, `0003` `admin_save_listing` 2026-11-10, `0004` stati di vendita e `0005` ricostruzione del sito 2026-11-10, … `0009` archivio, delete e bulk, `0010` delete di qualsiasi copia, … `0012` attributes, `0013` grading per lato; applicate dall'editor SQL di Supabase). Qui solo il riassunto:

| Tabella | Cosa | Note |
|---|---|---|
| `grades` | scala di Gio (Q8): `M, NM, NM-, EX+, EX, EX-, VG+, VG, VG-, G+, G, G-, F` | `rank` 1 = migliore → filtri "da VG+ in su" |
| `releases` | la pressatura | label, paese, anno (`year` + `year_precision` year/decade: "1990s" = 1990 + decade, 0018), formato, `macro_genre` text[] (genre Discogs, es. Reggae: non mostrato), `genres` text[] (copia ordinata dei nomi di `genres`, letta dal negozio) |
| `release_lines` | artista/titolo per lato (riga 1 = lato A…), dal form "Create listing" | artista vuoto = stesso della riga 1 (non mostrato). Nome mostrato: `custom_title`, altrimenti "Artist - Title 1 / Title 2" (o "Artist 1 - Title 1 / Artist 2 - Title 2") |
| `genres`, `release_genres` (0011, rinominati in 0014) | generi (= styles Discogs: Roots, Dancehall…) come entità con `slug`, in ordine per release; filtro Genre della PLP | `releases.genres` resta = i loro nomi in ordine. Fino alla 0014 si chiamavano `subgenres` |
| `tags`, `release_tags` (0007, 0011) | tag di Gio (Rare, Killer version…), mai da Discogs, in ordine per release | filtro Tags della PLP |
| `collections` (0038) | collezioni curate di Gio: nome, slug, regole (years text[] "1983"/"1960s", genre_ids, tag_ids), on_home, sort_order | card in home + `/collections/<slug>/` (decisione 0174); il match è in `packages/collections` |
| `artists`, `labels` (0006) | entità con nome **ufficiale**, `slug` (pagina futura), id Discogs | `artist_aliases` / `label_aliases` = altre grafie. Le righe le collegano con `release_line_artists` (più artisti per riga, in ordine, con "&"/"feat."); la release con `label_id`. `release_lines.artist` e `releases.label` restano = il **credito come stampato** su quel disco (lo mostra il negozio) |
| `release_credits` (0032, decisione 0148) | i credits Discogs della release (Producer, Mixed By, Backing Band…: tutti i ruoli), in ordine | `artist_id` = la stessa entità `artists` degli interpreti; `role` come scritto su Discogs; `credit` = nome stampato (ANV) se diverso; `tracks` = posizioni Discogs (null = tutta la release). Non mostrati nel negozio: la ricerca usa solo i produttori. `releases.credits_fetched_at` = quando sono stati letti |
| `listings` | la copia pubblicata (copy + listing del brief) | `section`, `status`, `price_cents`, `condition_media` (lato A) + `condition_media_b` (lato B, facoltativo, 0013) → `grades`, `sleeve_type` (`original`/`generic`/`none`) + `condition_sleeve` → `grades`, `photo_keys[]` (la **prima è la featured/cover**), `sku` (5 cifre casuali, mai riusate: registro `used_skus` + trigger, migrazione 0020), `custom_title`, `custom_title_links` (link del titolo a mano: range di caratteri → artista, `null` = derivati come in 0111; migrazione 0031, decisione 0147), `condition_notes`, `reserved_until`, `sort_order` (ordine del negozio deciso da Gio col drag in admin: numerico, più basso = prima; nuovi e appena pubblicati in cima; `admin_move_listing`, migrazione 0029, decisione 0129), `import_source` (solo test) |
| `samples` | clip della release | `audio_key`, `line_id` (sample del lato; vuoto = "additional"), `sort` = ordine nel player |
| `orders`, `order_items` | ordini Stripe | li scrivono solo le Edge Functions; prezzo copiato al momento dell'acquisto. L'admin può eliminarli con `admin_delete_order` (0036, decisione 0170: ordini di test o errori; i dischi ancora sold tornano available se scelto; Stripe non viene toccato) |
| `admins` | l'operatore (Gio) | riga aggiunta a mano dopo la registrazione all'admin |

Rimandato (con il Trade, Q2): `proposals`, `proposal_messages`. Preferiti: non nell'MVP. Account cliente: vedi sotto "Account cliente".

**Dati di prova:** `supabase/scripts/build-seed.js` genera `supabase/seed.sql` (upsert, id derivati dallo slug) dai 21 JSON di `content/products/`. Le immagini e i sample di prova restano URL assoluti verso il negozio di origine: è l'unica eccezione alla regola "solo chiavi".

## Sicurezza (RLS)
- **Pubblico (anon):** lettura di `releases`, `samples` e dei `listings` con `status <> 'draft'`.
- **Admin:** un solo utente Supabase Auth (Gio), presente in `admins`; `is_admin()` nelle policy. Niente ruoli.
- Nel progetto le tabelle nuove **non** sono esposte in automatico: ogni migrazione dichiara i suoi `grant`. Neanche `service_role` ha grant sulle tabelle: le Edge Functions leggono le tabelle pubbliche con la chiave anon (es. `create-checkout`).
- Una release (pressatura, `discogs_release_id` unico) può avere più listing (copie): creare un listing con una release Discogs già presente la condivide (migrazione 0024 `20261115050000_reuse_release.sql`, applicata 2026-11-15); se la nuova copia non manda sample, restano quelli della release. "Sell again" in admin crea una copia gemella dello stesso disco (decisione 0100).
- **Ordini:** nessun accesso pubblico; li scrivono solo le Edge Functions (service role).

## Storage (R2)
```
photos/<uuid>.webp     (foto del listing, la prima è la featured; lato lungo 1600)
photos/<uuid>-w200.webp, -w400.webp, -w800.webp   (copie più piccole della stessa foto, decisione 0108)
samples/<uuid>.mp3     (sample; lato e ordine stanno nel DB)
```
Chiavi casuali e immutabili (2026-11-10): l'upload avviene prima che il listing esista, e un file non viene mai sovrascritto (cache sicura).
- L'upload va dall'admin **direttamente su R2** con un URL firmato rilasciato da una Edge Function (`sign-upload`, solo per l'admin).
- Immagini ridimensionate nel browser prima dell'upload (webp, lato lungo 1600 px) **più tre copie** a 200, 400 e 800 px (decisione 0108, larghezze in `packages/images/images.js`). Il negozio usa `srcset`/`sizes` solo per le foto di cui il build trova le copie (un HEAD sull'ultima, `-w800`); senza copie resta il file unico. Foto caricate prima del 2026-11-17: admin → Settings → *Make photo sizes* (serve `GET` nella CORS policy del bucket R2). `purge-media` cancella le copie con la foto.
- Sample: mp3 128 kbps, 30–60 s, già tagliati da Gio (es. Audacity). Un mp3 sopra ~160 kbps (es. 320) viene ricodificato a 128 kbps nel browser prima dell'upload (lamejs, decisione 0108); uno a 128 resta com'è. Tagliarli dentro l'admin si può aggiungere dopo.

## Flussi

### Creare un listing (admin)
1. **Fetch Discogs** (2026-11-10, Figma 2103:20718): incolli link o numero della release in "Discogs match" → il pulsante chiama l'Edge Function `discogs-lookup` (solo admin, User-Agent proprio, token opzionale `DISCOGS_TOKEN` nei secret; niente cache, ToU 6 h) e riempie **solo i campi della release**: righe artista/titolo (una per traccia; artista vuoto se uguale alla riga 1), label, cat. no (non mostrato, salvato), anno, paese, formato, macro genere (il primo genre Discogs), generi (= styles Discogs). Prezzo, condizioni, note, foto e sample restano; i sample di righe sparite diventano "additional". Valori fuori dai vocabolari del form (paese, formato, altri macro generi) vengono elencati nel messaggio, non inventati. Foto Discogs: non importate (diritti). La ricerca per testo (serve il token) è nella stessa funzione: `{ query }` → fino a 8 release (Discogs match di Create, 0156; Which record di Bulk). **Foto della label** (Create listing, 0090/0092; Memo tolto, 0171): l'admin rimpicciolisce la foto e la manda all'Edge Function `read-label` (solo admin), che la fa leggere a un modello vision gratuito di Cloudflare Workers AI (quota Workers Free 10.000 neuron/giorno, ~60 a foto; secret `CF_ACCOUNT_ID`, `CF_AI_TOKEN`, opzionale `CF_AI_MODEL`); la foto non viene salvata. I campi letti vanno a `discogs-lookup { fields }`: barcode, poi numero di catalogo, poi artista + titolo, fino a 5 release.
2. Condizione, prezzo, note, foto, sample.
3. Salva = **una chiamata** a `admin_save_listing(payload)` (una transazione: release, righe, listing, sample). `draft` → **Pubblica** = `available` + `published_at`; poi ricostruzione del sito.
4. Copertina: il grado è ammesso per busta `original` e `generic`, mai per `none` (0003).

### Scanner macOS: nomi dei file dai draft (decisione 0138, 2026-11-22)
- Edge Function `scan-targets` (sola lettura, **Verify JWT ON**, solo admin via `is_admin()`, stessa sessione email OTP dell'admin): `{ query }` → fino a 20 draft (SKU, titolo, cat. no, prima foto), filtrati in funzione su SKU, artista, titolo, custom title, cat. no; `{ id, roles }` → i nomi delle immagini 1…N (1 Label A, 2 Label B, 3+ Other photo). Non scrive niente: nessun upload, nessuna modifica ai draft (Gio: non ancora).
- Edge Function `scanner-push` (decisione 0142, **Verify JWT ON**, solo admin): il bottone Push to admin dello Scanner. Lo Scanner carica i file su R2 con `sign-upload` (come l'admin: foto WebP + misure, clip MP3 128), poi `{ id, check: true }` → cosa ha già il draft; `{ id, mode: replace|fill, photos [{role,key}], clips [{line,key}] }` → `listings.photo_keys[role-1]` e una riga `samples` per line (posizioni A, B…, ordine delle line, titolo scritto da Gio tenuto). Solo draft; nessun file cancellato dallo storage. Niente migrazione (bastano le policy admin). Deploy dal dashboard come `scan-targets`.
- Edge Function `scanner-draft` (decisione 0145, **Verify JWT ON**, solo admin): il New draft dello Scanner. `{ releaseId }` → se esiste già un listing della stessa release 409 `{ existing: [{ id, sku, status }] }`, altrimenti legge la release con `discogs-lookup`, la mappa con `packages/listing-draft` (copia `listing-draft.js`, `npm run sync:functions`) e salva con `admin_save_listing` → `{ draft: { id, sku } }`; `force: true` crea comunque. Stesso draft del vecchio Memo → Create draft (0135, superata da 0171). Niente migrazione.
- I nomi li calcola `packages/file-names/file-names.js`, lo **stesso** file usato dall'admin (File names, 0136): `file-names.js` nella funzione è una copia (`npm run sync:functions`). Lo Scanner non costruisce mai un nome. Per sapere qual è il lato B la funzione legge le posizioni Discogs della release (come l'admin); se Discogs non risponde, ordine delle righe (`positions_read: false`).
- Tab Samples (decisione 0141, 2026-11-23): `{ id }` restituisce anche `clips` (una riga per posizione con clip: role, label, name, artist, title) e `tags` (album, label, cat_no, year se non è un decennio, genres) per gli ID3 dell'export. Sempre sola lettura.
- Deploy: dashboard → Edge Functions → nuova funzione `scan-targets` con `index.ts` + `file-names.js`; secret opzionale `DISCOGS_TOKEN` (già presente).

### Artisti ed etichette (0006, Gio 2026-11-10)
- Nel form (decisione DS 0020, 2026-11-10): Artist, Label e Tags sono campi a **chips** (`EntityField`): ogni chip è un'entità, il testo che non diventa chip non si salva. Menu: entità esistenti, alias "grafia → ufficiale", "Create …". Artist e Tags più chips (gli artisti di una riga si uniscono con "&"), Label una. Checkbox "Different spelling" → compare il campo "Artist name on label" / "Label spelled on record" = grafia sul disco.
- Al salvataggio (`admin_save_listing`) il collegamento: id scelto → id Discogs → nome o alias (maiuscole indifferenti, vince il più vecchio) → entità nuova. Una grafia diversa dall'ufficiale diventa alias in automatico.
- Fetch Discogs passa nome ufficiale, ANV (come stampato) e id Discogs dell'artista/label; con più artisti su una traccia arriva una chip per artista, ognuna col suo id Discogs. Il credito come stampato diventa alias solo se la riga ha un solo artista.
- Pre-release (0008): `releases.pre_release` (boolean, della pressatura, non dell'etichetta): checkbox "Pre-release" sotto Label; il negozio scrive "Pre" dopo il nome della label.
- Generi e tag (0007, 0011, 0014): stesso collegamento per nome (senza alias né id Discogs); il salvataggio riscrive `releases.genres` con i nomi dei generi in ordine.
- Dati esistenti: un'entità per nome distinto (i 21 dischi di prova hanno nomi combinati tipo "A & B" in maiuscolo: da sistemare a mano se servono).

### Credits e produttori (0032, Gio 2026-11-23, decisione 0148)
- `discogs-lookup { releaseId }` restituisce anche `credits` (extraartists della release e delle tracce). Per i produttori nuovi legge anche le varianti del nome e il nome reale da Discogs (una richiesta in più, solo la prima volta): diventano alias dell'artista, così "Coxsone" trova un disco accreditato "C.S. Dodd".
- Dopo `admin_save_listing`, `admin_set_release_credits(release, credits)` sostituisce i credits della release (Create/Edit dopo Fetch Discogs, memo rimasti convertiti in draft, Scanner). Un Edit senza Fetch Discogs non li tocca. Un errore sui credits non annulla il salvataggio.
- Dischi già presenti: Edge Function `release-credits` (solo admin, Verify JWT ON): `POST { limit? }` legge fino a 20 release senza `credits_fetched_at`, 1,5 s l'una dall'altra; si richiama finché `remaining` = 0. Contiene una copia di `packages/listing-draft` (`npm run sync:functions`).
- Negozio: `data/products.js` legge `release.credits` (con gli alias dell'artista); `pages/plp.js` mette nel testo di ricerca i ruoli `SEARCH_ROLES` (oggi `/produc/i`). Senza la migrazione 0032 il build va avanti senza credits.
- Attributes: i credits contano come collegamenti dell'artista (un artista ancora accreditato non si cancella; Replace sposta i credits sulla prima entità scelta).

### Attributes (0012, Gio 2026-11-10, decisione di design 0034)
- Pagina admin per artisti, label, generi e tag: lista con conteggio dei record, modifica (nome, alias, ID Discogs, slug), creazione a mano.
- **Replace with** (`admin_replace_entity`): sposta i record su una o più entità e cancella la vecchia. Una = merge (nome e alias diventano alias), più di una = split. Il merge dalla lista (`admin_merge_entities`) tiene quella scelta.
- Si elimina solo un'entità senza record (`admin_delete_entities`). I crediti stampati non cambiano mai. Cambiare nomi o collegamenti di generi e tag rimette in coda la ricostruzione del sito.

### Stati di vendita (0004)
```
draft ──► available ──► reserved ──► sold (sale) / traded (trade)
(una bozza può essere incompleta: senza grading, formato, prezzo, artista della riga 1 — nata da Bulk create 0107, rimosso con 0172; oggi le bozze dello Scanner, migrazione 0026; il trigger `listings_publish_check` li pretende appena esce da draft)
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
- **Video dei dischi sul server** (decisione 0195, migrazioni 0042 `video_jobs` + 0043 grant a service_role, applicate 2026-11-26): admin → Make video → Edge Function `render-video` (**Verify JWT OFF**: controlla da sola l'admin; il workflow si presenta col token OIDC di GitHub Actions, nessun segreto condiviso) → riga `video_jobs` + `repository_dispatch` → workflow `.github/workflows/render-video.yml` (ffmpeg, `.github/scripts/render-video.sh`) → `videos/<uuid>.mp4` su R2 → riga `done`, l'admin mostra Download. Segreti di `render-video`: `GITHUB_DISPATCH_TOKEN` (token fine-grained solo per questo repo, Contents: read and write) + quelli R2 di `sign-upload`; facoltativi `GITHUB_REPO`, `MEDIA_BASE_URL`. Senza token l'admin fa il video nel browser (0194). I video non vengono mai cancellati per ora.
- **Pulizia R2**: `media_trash` raccoglie anche le foto tolte nel form e i sample rimossi o sostituiti. La Edge Function `purge-media` (chiamata dall'admin all'apertura di Listings) cancella da R2 solo le chiavi in cestino da più di 7 giorni e non più usate da nessun listing o sample. Gli upload abbandonati prima del salvataggio non sono nel DB: restano su R2.

### Checkout: vince chi paga per primo (decisione 0116, migrazione 0028, 2026-11-18)
Sostituisce l'hold qui sotto. **Avviare il checkout non blocca niente**: il disco resta available per tutti mentre qualcuno è su Stripe.
1. `create-checkout`: `checkout_items(ids)` (tutti available o niente, nessun update) → minimo e spedizione → sessione Stripe con `payment_intent_data.capture_method = manual` (solo autorizzazione) → `checkout_open(session, ids)` (tabelle `checkout_sessions` + `checkout_session_items`: un disco può stare in più sessioni).
2. `stripe-webhook` su `completed` / `async_payment_succeeded`: `checkout_claim` blocca le righe e fa tutto o niente.
   - Preso → ordine + sold, **capture** del pagamento, `checkout_rivals` → le altre sessioni aperte con quei dischi vengono fatte scadere su Stripe. Email come prima.
   - Perso (venduto un attimo prima) → niente venduto, sessione `lost`, **cancel dell'autorizzazione** (rimborso solo per metodi già addebitati), email al buyer "not charged" + nota a Gio.
3. Pagina thanks: chiede `checkout_result(session)` (anon: solo `paid` / `lost` / `pending`); su `lost` dice "Order not completed" e rimette i dischi nel bag.
4. Ritorno senza pagare (Back, cancel_url, bag riaperto): la sessione viene fatta scadere su Stripe (PR #171).
5. Collisioni: `select count(*) from checkout_sessions where status = 'lost'`. Se diventano frequenti → altra strategia (Embedded Checkout + heartbeat).
Gli hold creati prima della 0028 finiscono da soli entro 33 min (`checkout_release` resta per loro).

### Best offer (decisione 0158, migrazione 0034, 2026-11-23)
- `listings.price_mode` 'fixed' | 'offers' (solo sale). Offers = niente prezzo, niente Bag: "Best offer" + "Make an offer" → `/products/<slug>/offer/`. Nessun minimo (scelta di Gio).
- Tabella `offers` (amount_cents, email, country, note, status unconfirmed → pending → accepted → paid | declined | closed; "expired" = accepted e 48 h passate). Solo via funzioni: `offer_submit`, `offer_confirm`, `offer_pay_info`, `offer_pay_open` (service role, Edge Function `offer`, Verify JWT OFF), `admin_offer_decide` (admin, Edge Function `offer-decide`, Verify JWT ON). Vista `admin_offers` per la pagina admin Offers.
- Anti-bot nella funzione `offer`: honeypot, proof of work (GET = puzzle), time trap 3 s, conferma via email (24 h; gli unconfirmed si cancellano dopo 2 giorni), limiti per email/disco/giorno.
- Accept: copia Reserved 48 h + link `/offer/pay/?t=`. Dal 2026-11-25 il link mette il disco nella Bag al prezzo dell'offerta, senza login (decisione 0188, migrazione 0041, sostituisce il login con codice di 0186/0040): la Bag tiene il token del link (`localStorage` `highmuzik-offers`) e legge l'offerta con `offer` pay-info; il checkout è quello della Bag (`create-checkout` con `offers: [token]` → `checkout_items(ids, tokens)` + `checkout_open_offers`, `customer_email` = email dell'offerta), senza minimo d'ordine se c'è un'offerta. Una copia Best offer riservata mostra "(Reserved) Notify me" come le altre (0189). Chi ha l'offerta accettata (link aperto in quel browser) vede invece "Add to bag" anche dopo un Remove, finché dura il hold (0190). (Prima: Stripe Checkout dedicato al singolo disco, azione `pay` di `offer`, ora inutilizzata.) Decline con messaggio opzionale (0187). `checkout_claim` accetta la sessione dell'offerta; al Sold le altre offerte aperte si chiudono e `stripe-webhook` manda l'email "venduto". Trigger `listings_close_offers` le chiude anche quando Gio segna sold/traded a mano.
- Secrets: `offer` usa RESEND_API_KEY, MAIL_FROM, SHOP_URL, STORE_NAME, ORDERS_TO (o OFFER_TO), STRIPE_SECRET_KEY, opz. ADMIN_URL, MEDIA_BASE_URL, POW_SECRET, ALLOWED_ORIGINS; `offer-decide` opz. ADMIN_ORIGINS.

### Checkout con hold
Regola (Gio 2026-11-12): **il bag non blocca mai niente**. Un disco è bloccato solo mentre qualcuno è dentro Stripe Checkout (max 30 min) e per gli altri si vede **Reserved**, non sold: resta in PLP, il bottone apre la spiegazione e "Notify me".
1. Il sito chiama `create-checkout` con gli id dei listing.
2. Update atomico: `status = 'reserved', reserved_until = now() + 30 min` **solo se** `available` (o se l'hold è scaduto). Se una copia non passa → "appena venduto", niente sessione.
2b. **Ordine minimo** (decisione 0072, Gio 2026-11-13): somma dei prezzi (dal DB) delle copie davvero bloccate, spedizione esclusa, contro `shipping_settings.config.min_order_cents` con `ZanzaShipping.minimumOrder()` (stesso file del Bag). Sotto il minimo → rilascia gli hold appena presi e risponde `below_minimum` con quanto manca; niente sessione Stripe.
3. Crea la sessione Stripe Checkout (`expires_at` = 30 min, il minimo di Stripe; righe con il prezzo letto dal DB, mai quello inviato dal client; tariffe di spedizione per zona).
4. Webhook `checkout.session.completed` → `orders` + `order_items`, listing `sold`, email Resend.
5. Webhook `checkout.session.expired` → listing di nuovo `available`.
6. Ritorno al Bag senza pagare: link "←" di Stripe (`cancel_url`), **Back del browser** (anche dalla cache back-forward, evento `pageshow`) o Bag riaperto. Il browser ricorda la sessione (`zanza-checkout` in localStorage) e chiama `create-checkout` `{ action: "cancel" }`: la sessione Stripe viene fatta scadere e i dischi tornano liberi subito, anche per chi l'aveva iniziata (bug 2026-11-17: col Back il buyer vedeva i suoi dischi Reserved per 33 min). Si sbloccano **solo** se Stripe conferma `expired` (o non conosce la sessione); pagata/in pagamento o Stripe irraggiungibile → l'hold resta (niente doppia vendita). Se lo sblocco fallisce, il Checkout successivo manda `previous` e il server chiude prima la vecchia sessione. Limite: tab chiusa su Stripe → sblocco alla scadenza (31 min, minimo di Stripe 30).

**Implementazione (2026-11-15, branch `claude/project-thread-3ixxqo`; migrazione 0021 applicata su store-staging e funzioni `create-checkout` + `stripe-webhook` deployate il 2026-11-15, Verify JWT off, `ORDERS_TO` impostato):**
- Migrazione `20261115020000_checkout.sql`: `checkout_hold(ids, token, minuti)` (tutto o niente, 33 min, il token `hold:<uuid>` sta in `stripe_session_id` finché la sessione non esiste), `checkout_attach`, `checkout_release(token o session)`, `checkout_complete(session, order)` (idempotente; una copia che la sessione non tiene più finisce comunque nell'ordine con `orders.attention` → rimborso a mano). Nuove colonne `orders`: `customer_name`, `subtotal_cents`, `payment_intent`, `attention`. Eseguibili solo dal service role.
- Edge Function `create-checkout` (Verify JWT off, origini come `trade-offer`): `{ ids, country }` → `{ url }`; `{ action: "cancel", session }` dal ritorno al Bag. Sessione Stripe 31 min < hold 33 min: una copia non si può pagare dopo che l'hold è scaduto. `shipping.js` è una **copia** di `packages/shipping/shipping.js` (`npm run sync:functions`; `npm run build` fallisce se è vecchia).
- Edge Function `stripe-webhook` (Verify JWT off, firma Stripe): `completed` (pagato) / `async_payment_succeeded` → ordine + `sold` + email al compratore e a Gio; `expired` → rilascio. Gli id dei listing tornano dalle line items (metadata `listing_id` del prodotto). Sta su Supabase perché il negozio è dietro Cloudflare Access.
- Secret nuovi: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ORDERS_TO` (casella del negozio; senza, usa `OFFER_TO`), opzionale `MEDIA_BASE_URL`.
- Eventi del webhook da attivare su Stripe: `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`.

### Account cliente (Gio 2026-11-15: "account light con codice OTP", decisione 0101; codice sul branch `claude/project-thread-c9cxpv`)
Requisito di Gio: il cliente entra e vede i suoi ordini e il loro stato.
- Checkout da ospite sempre; l'account non è mai obbligatorio. Nessuna password, nessun profilo, nessuna rubrica indirizzi: l'account è l'email verificata.
- Login: Supabase Auth email OTP (codice a 6 cifre, non link), Turnstile, SMTP di Supabase su Resend. Pagina Figma `Account` (2198:2395).
- Si entra solo se esiste un ordine con quell'email (hook *before user created*): niente account vuoti.
- Ordini collegati da soli: `lower(orders.email) = lower(email verificata)`, sola lettura (RLS o vista), senza `attention`, `payment_intent`, `stripe_session_id`.
- Stati mostrati: `paid` → "Paid, preparing" · `shipped` → "Shipped" + data (`shipped_at`) + link di tracking · `refunded` · `cancelled`. Niente "Delivered".
- Dettagli = email + "Delete account" (cancella il login, non gli ordini). L'email di conferma porta al login con l'email già compilata.
- Admin e clienti condividono Supabase Auth: tutto ciò che è concesso ad `authenticated` passa da `is_admin()` (verificato 2026-11-15); l'admin deve rifiutare al login chi non è admin.
- Privacy: sezione Account (art. 6(1)(b), token di sessione necessario, Turnstile); la durata di conservazione degli ordini va rivista per il venditore privato. Newsletter separata (Buttondown), nessuna iscrizione dall'account.

**Implementazione (2026-11-15):**
- Migrazione `20261115030000_customer_account.sql` (0022): `order_items.snapshot` (trigger BEFORE INSERT `order_items_snapshot` + backfill: nome, slug, label, formato, paese, gradi, `cover_key`, sample), `orders.shipped_at` (trigger: `shipped` → now(), di nuovo `paid` → null), `customer_orders()` (solo `authenticated`, email confermata; mai `attention`, `payment_intent`, `stripe_session_id`), `delete_my_account()` (non per un admin), `hook_before_user_created(event)` (per `supabase_auth_admin`). Testata su Postgres 16 locale con tutte le migrazioni.
- Sito: `pages/account.js` + `account.css` (3 pagine statiche, nessun dato personale nell'HTML), `scripts/account.js` (Auth via fetch: `/auth/v1/otp` → `/auth/v1/verify` type `email`, refresh, logout; sessione in localStorage `zanza-session`). Serve il build da Supabase (meta `zz-supabase-url`/`key`); col build JSON la pagina dice che gli account non sono attivi.
- Riferimento ordine = i primi 8 caratteri dell'id, maiuscoli (come email e admin, decisione 0100).

**Impostazioni Supabase Auth (progetto `store-staging`): FATTE il 2026-11-15 con l'ok di Gio** (hook acceso prima dei signup; hook verificato: email senza ordini → 403 "No orders for this email."; oggetto email "Your rythem-works sign-in code: {{ .Token }}"; la scadenza di 600 s vale anche per il magic link dell'admin). Da rifare uguale sul progetto di produzione:
1. SQL editor: applicare la migrazione 0022.
2. Authentication → Sign In / Providers → Email: *Allow new users to sign up* ON (l'hook limita a chi ha ordini); *Email OTP expiration* 600 s; *Email OTP length* 6.
3. Authentication → Hooks → *Before User Created* → Postgres function `public.hook_before_user_created`. Per creare un nuovo admin: spegnerlo un momento.
4. Authentication → Emails → SMTP: `smtp.resend.com`, porta 465, utente `resend`, password = una chiave Resend *Sending access* solo rythem-works.com, mittente `gio@rythem-works.com`, nome `rythem-works`. Senza SMTP proprio Supabase manda solo ~2 email l'ora e solo agli indirizzi del team.
5. Authentication → Emails → Templates *Magic Link* e *Confirm signup*: il codice `{{ .Token }}` in evidenza, poi il link `{{ .ConfirmationURL }}` (l'admin entra col link, il cliente col codice o col link).
6. Authentication → URL Configuration → Redirect URLs: aggiungere `https://staging.rythem-works.com/account/**` e `https://store-front-6fx.pages.dev/account/**` (il link dell'email porta a /account/: `scripts/account.js` passa `redirect_to`, altrimenti Auth userebbe il Site URL = l'admin). Aggiunto anche `https://rythem-works.com/account/**`.
7. Dopo: Turnstile (captcha) e la sezione Account della Privacy.

### Notify me (0016, 2026-11-12, migrazione da applicare)
- Su un disco Reserved il visitatore lascia l'email (`request_back_in_stock`, anon; solo mentre è reserved, max 100 per copia). Tabella `back_in_stock`, leggibile solo dall'admin.
- Ogni minuto `pg_cron` chiama l'Edge Function `notify-back-in-stock` **solo** se qualche richiesta è dovuta (la copia conta come available, anche per hold scaduto). La funzione manda **una** email (Resend) e cancella l'indirizzo.
- Venduto, scambiato, bozza o archiviato → le richieste di quella copia vengono cancellate (trigger).
- Segreti: Vault `notify_back_in_stock_url`, `notify_back_in_stock_secret`; funzione: `NOTIFY_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`, `SHOP_URL`, `STORE_NAME`. Deploy con `--no-verify-jwt`. Config e runbook: `email-setup.md`.

### Spedizione (0057, 2026-11-12)
- **Ordine minimo** (0072, 2026-11-13): `min_order_cents` nella stessa config (vuoto = nessun minimo), sezione "Minimum order" della pagina admin Shipping. Conta solo i dischi disponibili, spedizione esclusa. Il Bag lo mostra e blocca Checkout; create-checkout lo ricontrolla (sopra, passo 2b).
- Config in `shipping_settings` (una riga, JSON: formati con peso, mailer con max dischi per formato + peso, zone con paesi ISO, tariffe zona × mailer × peso massimo → servizio + prezzo). Si modifica dalla pagina admin **Shipping** (`admin_save_shipping`, che segna anche la ricostruzione del negozio).
- Calcolo unico in `packages/shipping/shipping.js`: il Bag mostra la stima per il paese scelto; create-checkout la ricalcola sul server e la passa a Stripe come una sola tariffa, con l'indirizzo limitato a quel paese.
- Solo paese, niente CAP. Finché non ci sono tariffe il Bag dice "Calculated at checkout".

### Stato dal vivo sul sito statico
Le pagine sono statiche, ma "sold/reserved" non può aspettare una ricostruzione: `site.js` legge gli stati da Supabase (una query per pagina, sola lettura) e aggiorna CTA e badge.
- **Fatto 2026-11-12:** la build (fonte Supabase) mette nella pagina URL e publishable key (`<meta name="zz-supabase-url|key">`); `site.js` legge `listing_availability` per gli id della pagina, del bag e del player, al caricamento, a ogni navigazione e quando la scheda torna visibile (al massimo ogni 30 s). Reserved → bottoni "Reserved", nota sotto la CTA della PDP, riga del bag "Reserved". Un id che non torna = non più pubblico → indisponibile.
- La PLP in build mostra `available` **e** `reserved`.

### Pubblicazione (0005, scelta di Gio 2026-11-10)
- Negozio su **Cloudflare Pages** collegato al repo GitHub: build `npm run build:pages` (`--target=pages`: sito alla radice, dati solo da Supabase), output `apps/storefront/dist`, variabili `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`.
- Un cambio a un listing pubblico (o che diventa / smette di essere pubblico) segna `site_build.pending`. Un job `pg_cron` ogni minuto chiama **una volta** il deploy hook di Pages (via `pg_net`) → negozio aggiornato in ~2 min. Le bozze e gli hold del checkout non ricostruiscono.
- **Interruttore trade** (0023, decisione 0102): `shop_settings.trade_enabled` è l'unica fonte di verità. Spento: la build non genera pagine/link/menzioni di trade, RLS nasconde i listing trade all'API pubblica, `trade-offer` e `discogs-search` rispondono 404. Si cambia da admin → Settings (`admin_set_trade_enabled`, che chiede anche il rebuild).
- **Record per pagina** (0039, decisione 0179): `shop_settings.records_per_page` (1–100, default 20) = quanti dischi per pagina in ogni PLP; admin → Settings (`admin_set_records_per_page`, rebuild). Colonna assente = 20.
- **Testi e "Show who I am"** (0025, decisione 0106): `site_texts` (key → value jsonb) = i testi che Gio salva da admin → Content (`admin_set_text`, rebuild); mancanti = i testi del repo (`packages/content/content.js`). `shop_settings.identity_enabled` (admin → Settings, `admin_set_identity_enabled`): spento = Store profile, nessuna traccia di Gio; `trade_enabled` diventa colonna generata `trade_wanted and identity_enabled`, quindi il trade si spegne con l'identità senza toccare build, RLS e funzioni.
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

_Last updated: 2026-11-12 (Reserved dal vivo + Notify me)_
