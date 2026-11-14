# 0083 — "View in store" opens the live shop page; "Preview" is the in-admin preview

`2026-11-14` · accepted · Figma: BACKEND → `listing form` › `action panel` (2120:1883), Create (instance 2120:2042)

**Context.** The admin action panel had a "Preview" button that opens the published PDP on the storefront in a new tab (enabled only when the listing is not draft/archived). The side column also has a "Preview" section: the live, unsaved shop preview (0030). Two different things had the same name. Gio: the button should read like "View in store".
**Decision.** The button label is "View in store" (Figma action panel component and `apps/admin/admin.js`). It links to `storefrontUrl/products/<slug>/` and is shown only when that page exists: hidden (not disabled) while creating a listing and for drafts or archived copies, where the side-column preview already shows the result (Gio, 2026-11-14). Figma: boolean `secondary 2` (the third button slot, renamed from `tertiary`: there is no tertiary button in the DS) OFF on the Create instance. The side section keeps "Preview".
**Rule.** "View in store" = link to the published page on the shop; "Preview" = an unsaved rendering inside the admin. Don't use one word for both. An action with no target is hidden, not shown disabled.
**Where.** `apps/admin/admin.js` (side → ActionPanel).
