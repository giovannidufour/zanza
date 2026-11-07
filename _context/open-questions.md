# Zanza — Decisioni aperte

> Da chiudere **prima** di scrivere codice. Quando una decisione è presa: aggiorna `product-brief.md`/`stack.md` e sposta la voce in "Chiuse".

## Q1 — Chi vende? 🔴 bloccante (decide lo stack)
- **Un solo venditore** (Zanza = un negozio, catalogo gestito da un admin) → commerce "normale", pagamenti semplici
- **Marketplace** (più venditori caricano dischi) → split dei pagamenti (Stripe Connect), KYC, policy, dispute: ×3 complessità
**Raccomandazione:** singolo venditore. Il marketplace si aggiunge dopo, se mai.

## Q2 — Trade: con il negozio o tra utenti? 🔴 bloccante
- **Utente ↔ negozio** (il negozio lista dischi che è disposto a scambiare; l'utente propone) → dominio contenuto, un solo "arbitro"
- **Utente ↔ utente** → è Vinyl Swap: non duplicare, semmai fondere i due progetti
**Raccomandazione:** utente ↔ negozio. Coerente con "Zanza è un negozio".

## Q3 — Fonte dei sample 🔴 bloccante (decide player e storage)
(a) link/embed YouTube-Discogs · (b) clip rippate hostate · (c) preview API ufficiali — vedi brief §3.
**Raccomandazione:** (b) per UX, con disclaimer e clip corte; (a) come fallback automatico dove manca la clip.

## Q4 — Volume e provenienza del catalogo
Quanti dischi (100? 2.000? 20.000?) e chi fa data entry? Sotto ~2.000 bastano i filtri del DB; sopra serve un motore di ricerca (Meilisearch/Typesense). L'admin con lookup Discogs è obbligatorio comunque, o il data entry uccide il progetto.

## Q5 — Mercati e valuta
Solo Italia? EU? Mondo? Decide IVA OSS, tariffe spedizione, lingue (IT/EN?).

## Q6 — Esito di una proposal accettata
Fuori app (MVP) oppure diventa un ordine a 0 € + spedizione (riusa checkout/etichette)? Raccomandazione: fuori app nell'MVP, ma modella `Proposal.completed` così che diventi ordine dopo.

## Q7 — Nome
"Zanza" è provvisorio. Verificare dominio e marchio prima di investire in brand/DS.

## Chiuse
_(nessuna)_

_Last updated: 2026-10-31_
