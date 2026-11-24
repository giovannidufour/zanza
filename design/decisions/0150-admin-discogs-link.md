# 0150 — Admin listing: link to the matched Discogs release

`2026-11-23` · accepted · Figma: BACKEND → `Create`, component `discogs link` (2479:4033), instances in "Create listing - desktop" and "- mobile" under Discogs match

**Context.** Gio (2026-11-23): from the admin listing page (draft, live, sold, archived, trade, any status) he wants to open the Discogs release the listing is matched to. Today the release is only a URL or number in the Discogs match field: to check it he has to copy it into a new tab.
**Decision.**
- New DS component `DiscogsLink` (Figma `discogs link`, TEXT prop `label`): "On Discogs ↗", body/small, underlined, text/strong; the same grammar as the Discogs link of `memo item` and `chosen release`, no new style.
- Placed in the Discogs section right under the Discogs match field, above the Fetch Discogs actions.
- Shown whenever the field holds a valid release (URL or number, `discogsId`), in every status, also when the form is locked (sold); it follows what is in the field, so a just-pasted release can be checked before Fetch Discogs. Empty or invalid field → no link.
- Opens `https://www.discogs.com/release/<id>` in a new tab (`rel=noopener`); screen readers hear "(opens in a new tab)".
**Rule.** A link that leaves the admin for Discogs is `DiscogsLink` (or the identical link inside memo item / chosen release), never a Button: Buttons stay for actions in the admin.
**Where.** `packages/ui` (`DiscogsLink`), `apps/admin/admin.js` (Discogs section). No backend change. Open: MemoItem and ChosenRelease still draw their own copy of the link (open.md).
