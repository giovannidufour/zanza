# 0059 — Mobile menu: a full-screen layer from the hamburger, Account is its entry point

`2026-11-12` · accepted (Gio) · Figma: page `menu` (2200:1676) → `menu item`, `menu layer`

**Context.** The mobile header shows only the hamburger, the logo, the store name and Bag: the Account button and the section tabs are desktop only, so on mobile there was no way to reach them.
**Decision.** The hamburger opens a full-screen native modal dialog built like the filters layer (bar with title + close, body that scrolls on its own, no actions). Groups: For sale / For trade · Account (detail "Sign in to see your orders", later the email) · Grading / Shipping / Contact · legal links (Impressum, Privacy, Terms, Withdrawal). Bag stays in the header. The page you are on is `state=current` (aria-current, `tab-background-active`). Body margin `page-margin-mobile`, rows keep padding `small`, so row text sits at 16 while the bar title is at 8 (Gio).
**Rule.** A navigation that lives in the desktop header must be reachable from the mobile menu. Layers that cover the screen are native modal dialogs with the filters-layer frame: the dialog takes focus on open, Esc and × close, focus goes back to the opener; following a link closes the layer first.
**Where.** `packages/ui/components.js` (`MenuLayer`, `MenuGroup`, `MenuItem`, `Header.menuProps`), `components.css`; `apps/storefront/pages/shell.js` (`SiteMenu`), `base.css` (`.site-menu`), `scripts/site.js` (`initMenu`).
