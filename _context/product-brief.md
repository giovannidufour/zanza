# rythem-trax — Product Brief (v0, 2026-10-31)

## Cos'è
Negozio online di vinili con due sezioni: **For Sale** (vendita) e **For Trade** (scambio con il negozio).
Da liste e schede si ascoltano i sample dei dischi.

## Flussi principali

### For Sale
1. PLP (lista) con filtri → PDP (scheda) → aggiungi al carrello → checkout → ordine
2. Preferiti: salva disco; se è venduto, resta visibile come "sold" (storico) e notifica se ricompare
3. Play sample da card (PLP) e da tracklist (PDP) senza interrompere la navigazione

### For Trade
**Aggiornato 2026-11-12 (decisione 0068, sostituisce i punti sotto per l'MVP):** "non è in vendita, convincimi". PDP trade con "Trade only", la nota di Gio (la descrizione dell'admin) e la sua Discogs card; CTA *Make an offer* → pagina offerta: dischi offerti (1–5, con i gradi), pitch, presentazione (chi sei + Discogs e/o Instagram), dove parliamo (Discogs, Instagram, email, oppure ci vediamo di persona), email. L'offerta arriva a Gio per email (funzione `trade-offer`), nessun account, niente salvato. Niente regola su chi spedisce: l'accordo si trova parlando. Pagine /how-trading-works/ e /about/. La wantlist di Gio non è mai pubblica. Fase 2: drop con finestra di offerte, card Discogs automatiche, offerte salvate.

Bozza originale (pre-MVP):
1. PLP trade → PDP trade (stessa anatomia, CTA **Trade** al posto di Add to cart)
2. Form proposta: cosa offro (1+ dischi: ricerca Discogs o inserimento manuale + condizione media/sleeve + foto), eventuale conguaglio in €, messaggio
3. Il negozio risponde: accetta / rifiuta / controproposta. Tutto tracciato in account → "My proposals"
4. Accordo raggiunto → spedizione/consegna gestita fuori app (MVP) oppure come ordine a 0 € (post-MVP)

**State machine della proposal (da definire subito, è il cuore del dominio):**
`draft → sent → in_review → countered ⇄ sent → accepted | declined | withdrawn → completed`
Il listing `trade` passa a `reserved` quando una proposal è `accepted`, a `traded` quando `completed`.

## Modello dati (bozza)

- **Release** — discogs_release_id, discogs_master_id, artist, title, label, cat_no, year, country, format (12"/7"/LP/EP), macro_genre[] (genre Discogs, es. Reggae, non mostrato), genres[] (gli style Discogs: Roots, Dancehall…), tracklist[], cover
- **Copy** — release_id, condition_media (lato A) + condition_media_b (lato B, facoltativo: "VG+ / VG"), condition_sleeve (Goldmine: M/NM/VG+/VG/G+/G/F/P), notes, photos[], price (solo sale), section (`sale`|`trade`), status (`available`|`reserved`|`sold`|`traded`)
- **Sample** — release_id, track_position, audio_url, duration, source
- **Proposal** — copy_id (il disco del negozio), user_id, offered_items[] {discogs_release_id | manual{artist,title}, condition_media, condition_sleeve, photos[]}, cash_adjustment, message, status, thread[] (messaggi/controproposte)
- **Wishlist**, **Cart** (il bag non riserva niente: l'hold parte solo al checkout, 30 min, e per gli altri la copia è **Reserved**, non sold; Gio 2026-11-12; **ordine minimo** sul subtotale dei dischi, spedizione esclusa, impostato dall'admin, 2026-11-13), **Back in stock** ("Notify me" su una copia Reserved: una email se torna disponibile), **Order**, **User**

Punto chiave: l'inventario è **per copia**, non per SKU+quantità. Due persone non possono comprare lo stesso disco → serve una riserva al checkout (hold) e un chiaro stato "sold" in PLP/PDP.

---

## Feedback di prodotto (Claude, da discutere)

### 1. Sale e Trade sono lo stesso oggetto con una CTA diversa — bene, ma non fermarti lì
L'anatomia PDP/PLP identica è corretta (una sola card, una sola PDP, prop `section`). Però la sezione trade porta con sé un dominio che il commerce non ha: proposte, thread, controproposte, stati. **È la parte che nessun servizio terzo ti dà pronta** e che decide lo stack (vedi `stack.md`). Non trattarla come "un form".

### 2. Discogs: usalo come lookup in admin, non come catalogo live
I Terms of Use (vedi `Vinyl Swap/_context/discogs-api.md`) vietano uso commerciale dei dati e cache > 6 h. Per un negozio il pattern sicuro è:
- in **admin**, cerchi la release su Discogs → importi i metadati **una volta** nel tuo DB (release diventa tua)
- il sito pubblico legge solo il tuo DB, mai Discogs
- alternativa a costo zero di rischio: i **dump mensili CC0** di Discogs
- nel form trade, la ricerca Discogs dell'utente è lookup puntuale (ok), ma salva nel tuo DB solo id + stringa, non "specchiare" la release

### 3. Sample: decidi la fonte prima del player
Tre strade, in ordine di rischio legale:
- **(a) link a video YouTube/Discogs** (Discogs espone i video della release) — zero hosting, zero diritti, UX peggiore (embed), già esplorato in Crate Witch
- **(b) clip 30–60 s rippate da te**, hostate su storage+CDN — UX migliore, zona grigia (fair use non esiste in EU; per dischi usati i negozi lo fanno comunemente ma resta un rischio)
- **(c) preview ufficiali** (Spotify/Apple preview API) — legali ma copertura scarsa su reggae/dancehall/pressature oscure

Il player persistente (mini-player + coda) ha senso solo con (b) o (c). Con (a) hai embed, non un player.

### 4. Preferiti ≠ wantlist
Non confondere con la wantlist di Crate Witch/Discogs. Qui "preferiti" è un segnalibro su una **copia** (quella copia a quel prezzo). Decidi cosa succede quando la copia è venduta: sparisce, resta come "sold", o diventa "avvisami se torna una copia di questa release" (il più utile, ma richiede di legare preferito → release, non → copy).

### 5. PLP per DJ/collezionisti: densità, non vetrina
Il pubblico vuole scorrere 200 dischi velocemente: vista **lista** compatta (cover piccola, artista/titolo/label/anno/condizione/prezzo/play) accanto alla griglia. Filtri che contano: genere (lo style Discogs), formato, condizione, fascia prezzo, label, anno, "solo con sample". Ordinamenti: nuovi arrivi, prezzo, A–Z artista.

### 6. Spedizione e tasse non sono dettagli
Vinile = pesante e fragile. Tariffe a peso/formato per zona, packaging, assicurazione opzionale. Sede in Germania, vendita in tutto il mondo (Q5): **IVA OSS** oltre soglia in UE, dogana extra-UE, eventuale Kleinunternehmer o regime del margine (Q5b). Questo spinge verso un servizio che calcola tasse e spedizioni per te (Shopify/Stripe Tax) invece di farlo a mano.

### 7. Cosa NON mettere nell'MVP (proposta)
- proposte di scambio tra utenti (P2P) — è Vinyl Swap, altro progetto
- chat libera: thread strutturato (proposta/controproposta/messaggio) basta
- valutazione automatica dell'equità dello scambio: mostra solo prezzo mediano Discogs come riferimento, il giudizio è umano
- multi-venditore / marketplace (vedi Q1)
- app mobile nativa: web responsive, player web

_Last updated: 2026-10-31_
