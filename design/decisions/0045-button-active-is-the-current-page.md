# 0045 — Button `active` = the current page: a link with aria-current, never disabled

`2026-11-10` · accepted (Gio) · Figma: `_button-states` state=active (2167:27176, 2167:27228); tokens `action/{primary,secondary}/{background,border}/active`

**Context.** Gio added `state=active` to `_button-states`: a menu button that stands for the page you are on (header Bag on /bag/) is shown active and is no longer clickable.
**Decision.** `active` is a real state, not a documentation pin (unlike hover/pressed/disabled, 0009). The button stays a link to its page, with `aria-current="page"`; it is styled by the `active` tokens (label `text/strong`), with no hover / pressed look and the default cursor. It is never `disabled`: a disabled control leaves the tab order and screen readers would not say where you are.
**Rule.** A navigation button for the current page = `state="active"` + `href`; style it from `[aria-current="page"]`. Never use `disabled` to mean "you are here". In Figma, set `state=active` on the instance of the current page and nothing else.
**Where.** `packages/ui/components.js` (Button), `components.css`, `components.d.ts`, `tokens.json`; `apps/storefront/pages/shell.js` (SiteHeader `current`).
