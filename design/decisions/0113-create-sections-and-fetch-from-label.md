# 0113 — Create listing: section nav, section headings, Discogs + images first, Fetch from label

`2026-11-17` · accepted · Figma: BACKEND → Create → `form section head` (2357:3262), `form section nav` (2357:5320, device=desktop | mobile), `discogs actions` boolean `fetch from label`; screens "Create listing - desktop · section nav" (2357:4296) and "Create listing - mobile · viewport · section nav (sticky)" (2357:5321)

**Context.** Gio: the Create / Edit listing page had grown many fields and felt chaotic. He directs the restructure block by block; this is the first step.
**Decision.**
- Order: **Discogs** (Discogs match, Fetch Discogs, Photo of the label) first, **Images** right after (no divider between them), then the rest as before. Custom title moved to the top of **Artist & title** (it replaces that title).
- **Fetch from label** in `discogs actions`, only while the listing has images: reads the listing's images one by one in list order (`read-label`, then `discogs-lookup { fields }`), stops at the first that finds releases and shows them as Photo of the label does; status "Reading image 2 of 4…". Fetch Discogs stays as it is (Gio).
- Every section has a heading (`form section head`, label/medium): Discogs · Images · Artist & title · Label & price · Genres & tags · Conditions · Description · Samples.
- **Section nav** (`form section nav`): one secondary small Button per section, state=active = the section in view (aria-current="true"). Desktop: left column, grid nav 2 + main 7 + side 3 (was main 8 + side 4); main and side keep their own scroll. Mobile: a row stuck to the top of the viewport on surface/page, scrolling sideways (cut at the edge), the active one scrolled into view; section heads stop under it. Pressing a Button scrolls to the section and focuses its heading.
**Rule.** A new block in the listing form is a `section` with a `FormSectionHead` and an entry in `FORM_SECTIONS` (the nav follows).
**Where.** `packages/ui` (FormSectionHead, FormSectionNav; Button keeps a passed aria-current), `apps/admin/admin.js` (FORM_SECTIONS, ListingForm sections + scroll spy, PhotoField readAll / Fetch from label, imageToBase64), `apps/admin/admin.css`.
Open: see design/open.md "Create sections (0112)".
