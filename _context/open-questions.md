# Zanza — Decisioni aperte

> Da chiudere **prima** di scrivere codice. Quando una decisione è presa: aggiorna `product-brief.md`/`stack.md` e sposta la voce in "Chiuse".

## Q2 — Trade: con il negozio o tra utenti? 🔴 bloccante (per il Trade, non per il Sale)
- **Utente ↔ negozio** (il negozio lista dischi che è disposto a scambiare; l'utente propone) → dominio contenuto, un solo "arbitro"
- **Utente ↔ utente** → è Vinyl Swap: non duplicare, semmai fondere i due progetti
**Raccomandazione:** utente ↔ negozio. Coerente con "Zanza è un negozio".

## Q5b — Regime fiscale 🔴 bloccante per il checkout
Sede in Germania, vendita in tutto il mondo (Q5 chiusa). Da verificare con uno Steuerberater: Kleinunternehmer §19 UStG? Differenzbesteuerung per l'usato? Soglia OSS? Vedi `stack.md` → Tasse e spedizioni.

## Q6 — Esito di una proposal accettata
Fuori app (MVP) oppure diventa un ordine a 0 € + spedizione (riusa checkout/etichette)? Raccomandazione: fuori app nell'MVP, ma modella `Proposal.completed` così che diventi ordine dopo.

## Q7 — Nome
"Zanza" è provvisorio. Verificare dominio e marchio prima di investire in brand/DS. Collegata al cambio di dominio (vedi `stack.md` → Portabilità).

## Chiuse
- **Q1 — Chi vende** (2026-11-09): un solo venditore, un solo operatore (Gio).
- **Q3 — Fonte dei sample** (2026-11-09): (b) clip registrate da Gio dai suoi dischi, hostate su R2. Il rischio sui diritti resta (registrare la propria copia non dà i diritti sulla registrazione): clip corte (30–60 s), mp3 128 kbps, disclaimer.
- **Q4 — Volume** (2026-11-09): ~40 dischi all'avvio, poi 10–20 a settimana, data entry solo Gio. Bastano i filtri del DB; lookup Discogs nell'admin.
- **Q5 — Mercati** (2026-11-09): sede in Germania, vendita in tutto il mondo. Partenza proposta: UE + UK/CH/US. Regime fiscale → Q5b.
- **Q8 — Scala di grading** (2026-11-09): scala di Gio, lista chiusa e ordinata `M · NM · NM− · EX+ · EX · EX− · VG+ · VG · VG− · G+ · G · G− · F` (niente P né M−). Copertina: stessa scala + tipo di busta (`original` / `generic` / `none`). Tabella `grades` con `rank`. Serve una pagina "Grading" sul sito (non è la scala Discogs).
- **Stack** (2026-11-09): Supabase + Stripe Checkout + admin custom → `stack.md`.

_Last updated: 2026-11-09_
