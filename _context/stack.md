# Zanza — Stack (opzioni, 2026-10-31)

Vincoli dati da Gio: **headless**, appoggiarsi a **servizi terzi**, codice in **inglese**.

## Cosa deve fare il backend
| Capacità | Chi la dà "gratis" | Chi NO |
|---|---|---|
| Catalogo, carrello, checkout, pagamenti, tasse, spedizioni, ordini, resi, account | un commerce engine | — |
| Inventario **per copia** con hold al checkout | parzialmente (quantità=1) | il "hold" va spesso costruito |
| **Proposal di scambio** (stati, thread, controproposte) | nessuno | va costruito sempre |
| Sample audio (storage, CDN, player) | storage+CDN | player custom sempre |

→ La domanda non è "quale commerce", ma **dove vive il dominio Trade**, perché è custom in ogni caso.

## Tre architetture

### A — Shopify (Storefront API) + Next.js + Supabase per il Trade
- Shopify fa tutto il commerce (checkout, Stripe/Shop Pay, IVA, spedizioni, fatture): **vai live prima**
- Trade proposals, sample metadata in **Supabase** (Postgres + Auth + Storage)
- ❌ **Due identità** (customer Shopify + user Supabase) da collegare: è il debito strutturale di questa opzione. Mitigazione: Shopify Customer Account API come unico login, Supabase riceve `shopify_customer_id`
- ❌ hold sul carrello: Shopify non riserva, serve logica tua o accettare la race (raro con pochi utenti)
- 💶 ~€27/mese Shopify Basic + Supabase free + Vercel free

### B — Medusa 2 (open source) + Next.js  ← **raccomandata**
- Commerce engine headless completo (prodotti, cart, checkout, ordini, clienti, Stripe, tasse, spedizioni) e **moduli custom**: il Trade diventa un modulo nel **medesimo backend**, stessa identità, stesso admin
- Inventario già per unità; hold = reservation nativa di Medusa
- Admin pronto (si estende con widget per lookup Discogs e proposte)
- ❌ devi hostare: Node + Postgres + Redis (Railway/Render ~€10–20/mese) oppure Medusa Cloud
- ❌ più superficie da capire all'inizio; il Mac non ha Postgres → sviluppo nel container/Docker
- 💶 ~€15/mese infra + Stripe a transazione

### C — Supabase + Stripe Checkout, commerce "a mano"
- Un solo DB, un solo auth, tutto tuo; Stripe Checkout + Stripe Tax + shipping rates evitano di scrivere pagamenti/IVA
- Perfetto per "1 copia = 1 prodotto": products/holds/orders sono tre tabelle
- ❌ ordini, resi, rimborsi, fatture, email transazionali: tutto da scrivere. Sembra poco, cresce sempre
- 💶 quasi zero fisso

**Perché B:** è l'unica in cui Sale e Trade stanno in **un solo modello di dominio** (single source of truth per utenti, copie, stati) — che è esattamente il criterio che usi per i design system. A è più veloce ma nasce con due verità; C è più leggera ma ti fa reinventare il commerce.
**Quando scegliere A invece:** se Q1/Q4 dicono "poche centinaia di dischi, voglio vendere entro un mese" e il Trade può essere un MVP con email.

## Servizi terzi (indipendenti dalla scelta A/B/C)
| Bisogno | Servizio | Note |
|---|---|---|
| Frontend | **Next.js (App Router) su Vercel** | layout radice persistente → il player audio non si ferma cambiando pagina. Astro non basta (navigazione full-page) |
| Pagamenti | Stripe | in A è dentro Shopify |
| Audio sample | **Cloudflare R2** (o Bunny) + CDN | mp3 128 kbps, 30–60 s, nome file = `{release_id}-{track}.mp3`; player con **Zustand** store globale |
| Immagini | Cloudinary o Vercel Image | cover dalla Discogs import, foto delle copie dall'admin |
| Ricerca/filtri PLP | DB finché < ~2k dischi; poi **Meilisearch** | facet: genre, format, condition, price, label, year, has_sample |
| Email | Resend | ordine, proposal ricevuta/controproposta/accettata |
| Lookup catalogo (admin) | Discogs API | solo lato admin, import una tantum — vedi brief §2 e `Vinyl Swap/_context/discogs-api.md` |
| Contenuti editoriali (opz.) | Sanity / MDX | solo se servono pagine "about", "guide alle condizioni" ecc. |
| Analytics | Plausible | niente GA: i ToU Discogs vietano esportare dati verso terzi |

## Struttura repo proposta (monorepo, inglese)
```
zanza/
  apps/
    storefront/      # Next.js
    backend/         # Medusa (B) · api/ (C) · assente in A
  packages/
    ui/              # design system (token → CSS vars, componenti)
    shared/          # types, Discogs client, condition grading enums
  docs/
```
Il DS vive in `packages/ui` come layer separato dal frontend, con i token generati dalle variabili Figma (stessa logica di `Crate Witch/design-system/`, ma codice nuovo).

## Primo passo tecnico
1. Chiudere Q1–Q3
2. Spike di 1 giorno: Medusa 2 in Docker nel container + un modulo `trade` con l'entità `Proposal` e la state machine. Se regge, è B; se è un incubo, A.

_Last updated: 2026-10-31_
