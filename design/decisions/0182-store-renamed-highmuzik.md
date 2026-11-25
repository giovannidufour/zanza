# 0182 — Store renamed HIGHMUZIK, internal identifiers included

`2026-11-25` · accepted (Gio: "tutto deve d'ora in poi essere highmuzik", "in generale il nome sempre in maiuscolo, compreso figma") · Figma: store name text in `header`, coming-soon page, footer copyright (mirrored in the same rename)

**Context.** The store was "Zanza" (provisional), then rythem-works (2026-11-15). On 2026-11-25 Gio renamed it HIGHMUZIK (domain highmuzik.com) and asked for the name everywhere, internal identifiers included. Nothing is launched yet, so renaming ids loses no visitor state that matters.
**Decision.** The name is written **HIGHMUZIK**, always uppercase, in every text people see (site, emails, admin, Figma, Scanner). Code identifiers follow code conventions: JS namespaces `window.Highmuzik*` (was `window.Zanza*`), CSS class and custom-property prefix `hm-` (was `zz-`), storage keys and temp names `highmuzik-*` (was `zanza-*`), package name `highmuzik`, Scanner bundle id `com.highmuzik.scanner`. Domain-dependent values (rythem-works.com URLs, emails, Buttondown username) switch in a second change, once highmuzik.com DNS and email are live. Decisions before 0182 keep the names of their time (append-only).
**Rule.** New text uses HIGHMUZIK in uppercase; new classes use the `hm-` prefix; new globals hang off `window.Highmuzik*`; new storage keys start with `highmuzik-`. Never reintroduce `zz-`, `Zanza` or `rythem-works`.
**Where.** Whole repo (rename commit); registry `_context/provisional-names.md` → "Rinomina → HIGHMUZIK".
