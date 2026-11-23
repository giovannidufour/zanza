# 0146 — Admin: Back to the list on a listing; File names section removed

`2026-11-23` · proposed · Figma: BACKEND → `Create`: new `back link` (page `admin`) above the title; `file name` component and the side `file names` frame removed

**Context.** Gio (2026-11-23): on a draft (and every listing of every type) he wants a "back to drafts" button. And now that the Scanner names and uploads the files itself (New draft 0145, Push to admin 0142, automatic export 0144), the admin's **File names** section with Copy (0136) is no longer needed.
**Decision.**
- **Back link.** Above the title of Edit listing, a `BackLink` ("← " + destination) to the Listings tab that holds this listing: draft → Drafts (`#listings/draft`), available / reserved → Live (`#`), sold / traded → Sold (`#listings/sold`), archived → Archived (`#listings/archived`). Create listing → "← Listings". The Listings page reads the tab from the hash (`#listings/<tab>`), so the link lands on the right tab. The list already remembers Gio's order (0129).
- **File names section removed.** Edit listing no longer shows File names / Copy; the per-release Discogs read it needed (positions, every time a draft with a release opened) is gone too. The naming rule itself (`packages/file-names`, `<sku>_<role>_<slug>`, 0136) stays: the Scanner and the Edge Function `scan-targets` still use it. The admin no longer loads `file-names.js`.
- **DS.** `FileNameRow` removed (component, CSS, types, docs, Figma `file name`); `BackLink` added (Figma `back link`).
**Rule.** A detail/edit page offers one way back to the list it came from, to the subset (tab) that holds the item. A feature that another tool now owns end to end is removed from the admin, not left as dead UI; shared rules it still relies on stay in their package.
**Where.** `apps/admin/admin.js` (BackLink on ListingForm, `#listings/<tab>` route, Listings initial tab; File names panel, `fileNamesOf`, positions effect removed), `apps/admin/admin.css`, `apps/admin/index.html` / `build.js` (no more `file-names.js`); `packages/ui` (`BackLink`, `FileNameRow` gone); Figma. Supersedes the admin part of 0136.
