# 0121 — Newsletter dialog; mobile swipe galleries show the next photo; no tile counter; no staging edit links

`2026-11-18` · accepted (Gio, "disegna e implementa, poi merge") · amends [0120](0120-home-v2.md), [0106](0106-admin-content.md) · Figma: page `dialog` → `newsletter dialog` (2398:2813); page `product card` → `product tile` device=mobile (photos 365); page `PDP` → `PDP - mobile` (photos 365); page `Home` → `Home - mobile` (intro 16 / 16, tile `counter` off)

**Context.** The home's "Subscribe to newsletter" scrolled down to the box; Gio wants a popup instead. On mobile the swipe galleries (PDP, home tiles) showed only 7px of the next photo (the page margin), which reads as no peek; with the peek, the tile's "1/3" counter is redundant.
**Decision.**
- **Newsletter dialog**: any link or button that points to the newsletter (`href` ending in `#newsletter`, or `data-newsletter-open`) opens a modal instead of scrolling: the Dialog shell (surface/base, 1px divider/strong, padding 16, gap 24, backdrop surface/scrim), head = "Get new records first" (label/large) + close `icon button` (icon-x, as the menu layer), body "Get them in your inbox as they’re listed.", then the footer newsletter (label hidden, note "You confirm with one click in an email and can leave anytime. Privacy"). Focus goes to the email field; close button, Esc and a click on the backdrop close it; focus returns to the opener. After a signup the form answers in place (0103). Without JS the link still scrolls to the home box.
- **Peek**: on mobile exactly `medium-small` (16px) of the next photo shows at the screen edge (Gio: "si devono vedere 16 pixel"). The scroller bleeds into the page margins; a photo = column − 16 + page margin − 1px gap (365 at 390). A single photo fills the column. Applies to the PDP gallery and the home tile gallery (Figma photos 365).
- **Tile counter**: off on the home (`counter: false`, Figma boolean off in the shelves); the component keeps it.
- **Home intro on mobile**: 16 above and below (was 16 / 8).
- **Staging edit links** (✎ strip, 0106): removed.
**Rule.** Signup entry points open the newsletter dialog; they never navigate. A horizontal swipe gallery always shows exactly medium-small (16) of the next item at the screen edge, never a full-width item with nothing beside it.
**Where.** `packages/ui` (`NewsletterDialog`, Gallery / ProductTile mobile widths and bleed), `apps/storefront/build.js` (dialog once per page; edit bar removed), `scripts/site.js` (7c), `home.css`, `pages/home.js`, `base.css`, `site.json`.
