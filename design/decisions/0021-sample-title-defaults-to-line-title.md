# 0021 — The sample title defaults to its line title

`2026-11-10` · accepted · Figma: samples overview row with title input (2095:20507)

**Context.** The shop shows a title next to each sample's play button (PDP). A sample usually plays a line of the record (side A, B), whose title is already in the form; additional samples (dub, versions) have no line.
**Decision.** In the samples overview each row has a title Input under the file row (Figma `sample row`, restructured 2026-11-10: remove next to the file name, input full width, gaps 16; no label: accessible name "Title of <file>"). It is prefilled with the line title and follows it until Gio types; additional samples start empty. Only a typed title is stored (`samples.title`); empty = no override, so the shop falls back to the line title (`apps/storefront/data/products.js`), and a sample with neither is an icon-only PlayerButton with an accessible name. Clearing a line sample's field therefore brings back the line title, not "no title".
**Rule.** A value derived from another field is shown prefilled, stored only when overridden, and resolved at read time, so it never goes stale.
**Where.** `apps/admin/admin.js` (overviewSampleItem), `FileItem` children, `apps/storefront/data/products.js`, `pages/pdp.js`.
