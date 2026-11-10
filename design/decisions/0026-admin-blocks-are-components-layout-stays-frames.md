# 0026 — Admin blocks are components; layout stays frames

`2026-11-10` · accepted (Gio asked to componentize the Create/Edit listing page) · Figma: pages `uploads`, `divider`, `listing form`; BACKEND → Create

**Context.** The Create listing page was drawn freestyle: rows, upload areas, dividers and the side panel were loose frames, so a change had to be repeated by hand.
**Decision.** Every block that repeats, or that Create and Edit share, is a Figma component mirrored 1:1 by a `packages/ui` component: `file item` ↔ FileItem, `drop zone` ↔ DropZone, `divider` ↔ Divider, `listing line` ↔ ListingLine, `action panel` ↔ ActionPanel. Variants only where the structure changes (`file item` type × state, `listing line` removable × sample: 4 each). Everything else is a boolean, a text property or an exposed nested instance. Sections and field rows stay named auto-layout frames in Figma and page CSS in the admin: their content differs every time, and without slots every instance would have to be detached.
**Rule.** Make a component when a block repeats or recurs across pages, with a code twin of the same name; keep one-off containers as named layout frames. Add a variant only for a structural difference; prefer booleans and exposed instances. Component sets keep Figma's default dashed border.
**Where.** `packages/ui/components.{js,css,d.ts}`, `packages/ui/docs/{Divider,ActionPanel,ListingLine,FileList,DropZone}`, `apps/admin/admin.js`.
