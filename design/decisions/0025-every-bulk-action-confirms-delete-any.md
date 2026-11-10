# 0025 — Every bulk action asks first; any listing can be deleted

`2026-11-10` · accepted (Gio) · supersedes parts of [0024](0024-delete-drafts-archive-the-rest.md) · Figma: BACKEND → Listings, `dialog`

**Context.** After using 0024, Gio wants to delete records for real, not only archive them, and a confirmation before every bulk action.
**Decision.** Delete works on any status. Two cases are kept and reported: a copy with an order (orders are accounting records) and a copy held by a live checkout. Archive stays as the reversible way to take a copy off the shop. Publish, Unpublish, Archive and Delete all open the Dialog first: title and confirm label = verb + count, body = the records, what happens, and which selected rows are skipped. Undo stays after the reversible ones.
**Rule.** A bulk action always confirms in the Dialog, naming the count, the records and the skipped rows; a reversible one also offers Undo after it ran. Deleting never touches orders.
**Where.** `supabase/migrations/20261110080000_delete_any_listing.sql`, `apps/admin/admin.js` (Listings).
