# 0062 — Search field: the magnifier submits, a × clears while there is text

`2026-11-12` · accepted (Gio) · amends [0061](0061-search-results-page.md) · Figma: `input` gets `state` (default | filled); `type=search, state=filled` (2216:369); header search field 280 wide

**Context.** The search field had no button: only Enter sent it. Gio wants a visible way to search and to empty the field.
**Decision.** In `input` type=search the magnifier sits in the trailing slot (it no longer moves: Gio) and is the form's submit button, accessible name "Search". While the field has text (`state=filled`), a × (`icon-x-thin`) in the leading slot clears it and keeps focus in the field, accessible name "Clear search". The header field on desktop is 280 wide (was 200, 0061). Without `submitLabel` / `clearLabel` (admin "Discogs match") the magnifier stays a decorative trailing icon.
**Rule.** An icon inside a field that does something is a real `<button>` with its own name; one that does nothing is `aria-hidden`.
**Where.** `packages/ui/components.js` (`Input`: `submitLabel`, `clearLabel`, `onClear`), `components.css` (`.zz-input__action`, `.zz-header__search`), `components.d.ts`; `apps/storefront/pages/shell.js` (`SearchForm`), `scripts/site.js` (clear).
