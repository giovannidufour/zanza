# 0093 — Private seller: slim legal pages, no Withdrawal

`2026-11-15` · proposed (Gio: "sono un privato che vende saltuariamente e vorrei evitare tutte quelle cose legali lunghe"; slim texts by Claude, not legal advice) · Figma: page `Legal` → `Legal - desktop · Terms`, `Legal - mobile · Terms`; `footer legal` and `menu layer` without Withdrawal

**Context.** 0079 wrote the legal pages for a trader (Unternehmer). Gio sells occasionally, as a private person, and does not want his home address or phone on the site.
**Decision.** Same template as 0079, shorter content: Impressum = name, a c/o address (not his home), email, "private seller"; no phone, no VAT line. Privacy = one screen (who, the services in one list, legal bases, rights). Terms = a few lines: private sale, used single copies as described, no withdrawal right and no warranty beyond the description, shipping, trades, German law. Shipping unchanged except returns. The Withdrawal page and its link (footer, mobile menu) are removed. Supersedes 0079's trader texts; 0079's template and Rule stay.
**Risk (accepted by Gio, to verify).** Whether he is private depends on how he sells (volume, regularity), not on the label: if a court sees a business, missing withdrawal right and Impressum can lead to an Abmahnung. A c/o address is common but not 100% safe; a P.O. box is not enough.
**Rule.** Legal texts follow the seller status recorded here; if Gio's volume grows to regular sales, revisit 0079's trader texts.
**Where.** `apps/storefront/content/legal/*.md`, `pages/legal.js` (`PAGES`), `pages/shell.js` (`LEGAL_LINKS`), `site.json` → legal.
