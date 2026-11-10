# 0024 — Delete drafts, archive the rest; bulk actions act where allowed

`2026-11-10` · accepted (Gio) · Figma: BACKEND → Listings (3 frames + notes), `dialog`, `checkbox` state=indeterminate

**Context.** Gio wants to delete listings and act on many at once. A published copy has a URL, a status history and maybe an order; a hard delete would break all three.
**Decision.** Delete is a hard delete of drafts never published (with their files, purged from R2 after 7 days). Anything that was published is archived instead: out of the shop and of the default tab, history kept, restorable to the status it had. Bulk actions: Publish, Unpublish, Archive, Delete. Each moves only the rows its transition allows and reports the skipped ones. Reversible actions run at once and offer Undo; Delete asks first in a modal Dialog (initial focus on Cancel). The bulk bar is always rendered at a fixed height; selection is a native checkbox column with a select-all (indeterminate when partial).
**Rule.** A destructive action that cannot be undone gets a Dialog naming the count and the items; a reversible one gets no dialog, only a result line with Undo. Never hide or reflow a toolbar on selection: keep its place and swap its content.
**Where.** `supabase/migrations/20261110070000_archive_delete_bulk.sql`, `supabase/functions/purge-media`, `apps/admin/admin.js` (Listings), `packages/ui` (Checkbox, Dialog).
