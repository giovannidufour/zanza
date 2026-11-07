# Zanza — Project Summary

> Leggi questo file all'inizio di ogni sessione su Zanza.
> Poi leggi i file in `_context/` prima di rispondere. Non proporre feature senza aver letto `open-questions.md`.

---

## What It Is

**Zanza** (nome provvisorio) — e-commerce headless di dischi in vinile con due sezioni:

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
| Fase | 🟡 Definizione + prototipo statico (PDP: header, breadcrumbs) |
| Owner | Gio |
| Prossimo passo | Chiudere Q1–Q3 in `open-questions.md`; continuare la PDP in Figma → porting in `packages/ui` + `apps/storefront` |

---

## Cosa c'è dove

| File | Contenuto |
|---|---|
| `_context/product-brief.md` | Cos'è, flussi, modello dati, feedback di prodotto |
| `_context/stack.md` | Opzioni di architettura headless, servizi terzi, raccomandazione |
| `_context/open-questions.md` | Decisioni aperte — da chiudere prima del codice |
| `design/README.md` | Come Figma → `packages/ui` → sito/artifact si collegano; regole, placeholder, naming Figma da sistemare |
| `packages/ui/` | **Design system in codice — unica fonte dei componenti.** `tokens.json` (mirror delle variabili Figma) → `tokens.css` (generato, mai a mano) · `media.js` (espande `@media (--mobile)` dal gruppo `breakpoint` di tokens.json: il breakpoint vive solo lì) · `components.js` (React, createElement, UMD) · `components.css` |
| `apps/storefront/` | Sito statico. `content/products/*.json` (modello del brief) · `pages/pdp.js` · `base.css` (reset + page shell) · `pdp.css` (grid di pagina) · `scripts/site.js` (comportamenti di sito: header che sparisce allo scroll down e torna sticky allo scroll up) · `site.json` (storeName, outputDir, basePath) · `build.js` → **`dist/zanza/` = la cartella da caricare via FTP** |
| `package.json` | `npm run build` (tokens.css + dist/) · `npm run build:artifact` (cartella da pubblicare come artifact DS). Claude lancia le build; Gio non usa il terminale |

## Stato del porting (2026-11-07)

Componenti in `packages/ui`: Button, Tabs/Tab, Header, Breadcrumbs, Tag/TagGroup, PlayerButton, ProductInfo, Gallery. Pagina: PDP (header, breadcrumbs, gallery, info, Add to bag). Artifact DS: https://claude.ai/artifact/9Q7SAYDqDnBAj4MEKLnphz

## Regole del codice

- `packages/ui` è l'unica implementazione dei componenti: l'artifact "Zanza Design System" (claude.ai) va rigenerato da qui, non scritto a parte
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

## Come aggiornare i file

1. Decisione di prodotto → aggiorna `product-brief.md` e chiudi la voce in `open-questions.md`
2. Scelta tecnica → `stack.md`
3. Cambia la struttura → aggiorna questo file

---

_Last updated: 2026-11-07_
