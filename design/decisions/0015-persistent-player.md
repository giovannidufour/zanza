# 0015 — Persistent player: native audio + soft navigation

`2026-11-07` · accepted · Figma: `player` (2033:10792), `_player controls`

**Context.** Samples must keep playing while the visitor moves through the site, in a player always visible at the bottom; the static multi-page site reloads (and kills the audio) on every link.
**Decision.** One native `audio` element inside the Player, rendered once per page outside `.zz-page`. `scripts/site.js` intercepts internal links, fetches the next page and swaps only `.zz-page` (history, title, focus to the new `h1`); any failure falls back to a normal load. The PlayerButtons of a product are the queue. The player slides up from below the viewport when a sample starts and slides away on close (200ms placeholder, off with reduced motion); the page reserves its height while open.
**Rule.** Anything that must survive a page change lives outside `.zz-page`. Page scripts re-initialise after a swap (`initHeader`). Components stay presentational and expose state as `data-*` the site can flip without React. Remove the soft navigation when the storefront moves to a framework with client routing.
**Where.** `packages/ui` Player, `apps/storefront/build.js`, `base.css`, `scripts/site.js`, `pages/pdp.js`.
