# 0122 — PDP breadcrumbs: section / genre, both links

`2026-11-22` · accepted (Gio, breadcrumbs review) · amends [0041](0041-plp-active-filter-replaces-breadcrumbs.md) · Figma: page `PDP` → `breadcrumbs` instances (desktop, mobile, sold out)

**Context.** The PDP trail was "For sale / Dancehall / 7”": only the section was a link, the format (an attribute, not a level) was marked as the current page (`aria-current`), and with no genre it fell back to the macro genre ("Reggae", never shown, 0048) or left an empty crumb.
**Decision.** The trail is **section / genre**, both links: the section opens its PLP, the genre opens the same PLP filtered by it (`?genre=`, as the genre tags; the PLP then shows the active filter, 0041 / 0073). No current-page item: the record is the h1. No format. No genre → only the section. The component no longer forces the last item to be text: a last item with `href` is a link, a last item without one is the current page. The "/" moves inside the item (`aria-hidden` span) so the list holds only the path.
**Rule.** A breadcrumb level is a place you can go back to (a link); attributes (format, condition) never go in the trail. Missing values drop the crumb, never fall back to a hidden taxonomy.
**Where.** `packages/ui` `Breadcrumbs` (js, css, d.ts, docs); `apps/storefront/pages/pdp.js` `breadcrumbItems`.
