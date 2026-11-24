# 0175 — Header: logo and store name are one link to the home; on the home it reloads the page

`2026-11-24` · accepted (Gio: "sia il click sull'immaginina del logo che sul nome del sito portino alla home page, e se sei già nella home page vorrei che si ricaricasse la pagina") · amends [0094](0094-header-logo-only-when-it-fits.md), [0085](0085-home-page.md) · Figma: page `header` → descriptions of `header` and `store name` (home link, reload on the home)

**Context.** Only the store name linked to the home; the logo was a plain image. On the home the name was `aria-current="page"` with `cursor: default`, and the soft navigation ignored a click on the page you are on, so nothing happened.
**Decision.**
- Logo + store name sit inside **one link** (`.zz-header__home`) to the home: one tab stop, its accessible name is the store name (the logo is `alt=""`, the small logo inside the name is `aria-hidden`). Layout unchanged (gap 8, top-aligned; the 0094 logo fit still switches big / inside / hidden). Focus ring = browser ring, like the other links without a focus token.
- **On the home** the link keeps `aria-current="page"` and the active look, but it is clickable (normal cursor) and **reloads the page**.
- The reload is **soft**: the soft navigation fetches the page again and swaps the content (fresh shelves, back to the top, focus on the heading), with no new history entry, and the **player keeps playing** (0015). The same applies to any link to the page you are on (e.g. Bag on /bag/), as a plain link reloads in a browser.
**Rule.** A link to the current page is never dead: it reloads the page softly. Logo and store name are never two separate links.
**Where.** `packages/ui/components.js` (`Header`), `components.css` (`.zz-header__home`), `components.d.ts`, `apps/storefront/scripts/site.js` (soft navigation click handler).
