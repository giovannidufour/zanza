# 0209 — Admin: the current tab is in the URL

`2026-11-27` · accepted · no visual change, no Figma

**Context.** Gio: on Listings → Drafts, a refresh went back to Live. Pages were already in the hash; the tabs inside a page were only component state.
**Decision.**
- Each tab row of a page writes its value into the hash: `#listings/draft|sold|archived`, `#orders/shipped|all`, `#offers/accepted|all`, `#dashboard/year|all`. The default tab (Live, To ship, New, This month) has no suffix, so old links keep working. Attributes already did this (`#attributes/<kind>`).
- Clicking a tab uses `history.pushState` (helper `tabToUrl`): the tab switches in place, no reload, and the click is one Back step.
- Back / Forward fire `hashchange`, so the router remounts the page on the tab in the URL (the list loads again).
- Search, filters and selection stay out of the URL: not asked.
**Rule.** A new tab row in admin goes through `tabToUrl` and gets a route in `App`; default tab = bare page hash.
**Where.** `apps/admin/admin.js` (`tabToUrl`, `Listings`, `Orders`, `Offers`, `Dashboard`, `App`, `sectionOf`).
