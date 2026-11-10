# 0042 — The stacked conditions comment is its own line, on the same 4px rhythm

`2026-11-10` · accepted (Gio) · Figma: PDP → `product info` and `product card`, layer `conditions` (boolean property `conditions`, default on)

**Context.** When the cover is graded, the conditions comment went under "Cover: …" through a line break inside the same paragraph, so it sat flush against it (0px) while description, record and cover lines are 4px apart. It was not drawn in Figma.
**Decision.** Figma gets a `conditions` text layer after `cover` in the description block of both components (both devices), same type as the grade lines; the block's 4px gap spaces it. Code: a `conditions` prop on `ProductInfo` and `ProductCard`, rendered as its own paragraph after `cover`. Without a cover line the comment still follows the record grade on the same line (0035 update): wrapping there is a line wrap, not a new line. Admin shop preview does the same.
**Rule.** Every stacked line of the description block is its own element spaced by the block gap; never stack text with a `<br>` inside one element. A new line in that block = a new Figma text layer + a prop.
**Where.** `packages/ui/components.js`, `components.d.ts` (`conditions`); `apps/storefront/pages/shell.js` (`gradingProps`); `apps/admin/admin.js` (preview).
