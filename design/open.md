# Open — the only backlog of design gaps

Everything undecided, parked or to fix lives here and nowhere else. When an item is decided it moves to a new file in [`decisions/`](decisions/README.md) and is deleted from this list. Product questions (Q1–Q7) are in [`../_context/open-questions.md`](../_context/open-questions.md).

## Pending decisions

- **Interaction overlay for all clickables.** Reuse `action/floating/background/*` as the hover/pressed tint everywhere, links included? Proposal: rename to `interaction/overlay/*`, add an inverse pair (`white-a4/a8`) for dark surfaces, keep the underline on links (WCAG 1.4.1), implement as a `::before` overlay. See [0007](decisions/0007-floating-actions-foreground-background.md).
- **Focus state.** None designed, none shipped. Needs a `border/focus` token before launch (WCAG 2.4.7). *Parked.*
- **Motion tokens.** 150ms ease-out (dashed border, FileList reorder slide) and 200ms (header reveal) are placeholders. *Parked.*
- **Breakpoint value.** `<768px` is a placeholder in `tokens.json`. See [0004](decisions/0004-one-breakpoint-in-tokens.md).
- **Spacing scale / dimension tokens.** Paddings are hardcoded as in Figma; only `page-margin-*`, `gutter-small`, `small` exist. *Parked.*
- **Type size tokens.** Coming later; until then the classes carry the sizes ([0003](decisions/0003-type-styles-are-classes.md)).
- **PlayerButton disabled.** No strikethrough, unlike Button: intentional?
- **Gallery.** Figma component not designed yet; image placeholder fill `#f2f4f7` has no token. *Parked.*
- **PDP gallery scroll ([0033](decisions/0033-pdp-gallery-scrolls-on-its-own.md), [0036](decisions/0036-pdp-gallery-moves-with-the-page.md)).** Code choices not drawn in Figma: no scrollbar (nothing hints that image 2 continues when the window is shorter than the column); the gallery moves with the page (0036). In Figma row 1 is FIXED 330.67, valid only at 1024: a taller info block would overflow it there (code grows the row). To confirm or design.

- **Player track number.** Figma shows "1" next to the title and "1 of 3" in the controls; code maps the first to the track position on the record (A, B) — to confirm.
- **ProductCard link.** No link to the product page in Figma. Code: the cover is the link (`href`, no visual change, so the PLP is navigable). Proposal: the title becomes the link too (link style to design).
- **ProductCard "Add" (mobile).** Button small = 32px: passes WCAG 2.5.8 (24) but under the 44px touch recommendation (2.5.5).
- **"More for sale" content.** PDP `RelatedProducts` shows up to 3 other available products of the same section, most shared styles first (`apps/storefront/build.js` → `relatedTo`). Placeholder logic until the backend recommends.
- **PLP filters (0028).** Working since 2026-11-10. Not designed: "Clear filters", the empty result (code: "No records match these filters.", copy by Claude), the loading of many options (a long Subgenre list has no "show more"). The Tags block appears as soon as a listing has one of Gio's tags (0031). Figma `filter` still has the unused `content=tag` variant.
- **Tag as a link (0028).** Since 2026-11-10 tags on card and PDP link to the filtered PLP. Figma `tag item` has no hover / focus / pressed states; the code shows the browser's focus ring only. Gio: ignore for now.
- **PLP mobile filters.** Figma PLP - mobile has no filters: hidden below the breakpoint. Where they live on mobile (drawer from the hamburger? a "Filters" button?) is to design (Gio: later).
- **Filter count contrast.** `text/moderate` on the acid green page is below 3.6:1 (fails 1.4.3). Gio (2026-11-10): ok for now, he will change the value of `text/moderate`. The count is also read by screen readers as part of the option name.
- **PLP sample labels.** Card samples are "1", "2" (Figma); the PDP shows the sample title. Accessible name in code: "<product>, sample 1: <title>".
- **PDP sample title longer than the screen (mobile).** Samples wrap onto new rows (Figma `slot container` 2018:10164), but the label is `nowrap` as in Figma, so one title wider than the viewport still overflows. Proposal: let the label wrap under the icon, or truncate with ellipsis; to design.
- **Player "Add to bag".** Rendered, no action yet (no cart).
- **Sample audio.** `audio_url` must be a direct file (mp3/aac/ogg). Sample B uses a reggaefever.ch URL (hotlinking and rights to verify); sample A is still a generated test tone (`public/test-sample-a.mp3`). Depends on Q3.
- **Home link.** `/zanza/` is a meta-refresh page, so the soft navigation falls back to a full load there and the audio stops. Fixes itself with a real home page.

- **Alert colour (input error).** `#ff5d16` is a literal in Figma, no variable: code ships it as PROVISIONAL `text-alert` / `border-alert`. Contrast: 3.1:1 on white (fails 1.4.3 for the 14px message), 2.4:1 on acid green (fails 1.4.11 for the border too). Proposal: Figma variables `text/alert` + `border/alert`, text value darker (e.g. ~#c23c00 = 5.3:1 on white). `emphasis=success` `#009951` (3.7:1) has the same problem; not ported.
- **`text/moderate` contrast.** black-a48 = ~3.6:1 on white, less on `surface/subtle`: fails 1.4.3 for placeholder, "Optional" and the locked value. The locked value (SKU) is real information: proposal `text/strong` for it, keep `moderate` for the placeholder only.
- **Input focus.** Same gap as above (Focus state): inputs keep the browser outline, never removed, until a `border/focus` exists.
- **Entity field (chips).** Built (0020). Open: chip focus ring is a 2px `text-strong` outline drawn by Claude (no focus token, see Focus state) · the remove-× hover (`surface/subtle`, 4% black) barely shows on `surface/support-1` · with `chips` on, the field padding is an instance override (6) to stay 38px: a `size`-like property would be cleaner · `compact` size with chips not designed · the menu has no "loading" or "max results" state (code: first 8 matches) · join text between artists is always "&" (DB supports "feat."; add a picker when a real record needs it).
- **DropZone drag-over state.** Not designed: dropping works, no visual feedback. Dashed [16,16] is a static pattern, distinct from the [4,4]/[2,2] hover/pressed of 0005.
- **FileList drop slot style.** While dragging, the row follows the pointer (its number shows the slot it will land in) and leaves an empty slot of its size (Gio, 2026-11-10). The dragged row is `file item` state=dragging (surface/base, opaque). The slot has no style: proposal, if it reads too weak, a `drop slot` in Figma (e.g. surface-subtle, or the dashed border of the drop zone).
- **FileList reorder without dragging.** Pointer reorder is drag-only (WCAG 2.5.7 needs a single-pointer alternative); keyboard ↑ ↓ on the handle is in code. Proposal: "move up / down" in a row menu, or arrows next to the handle.
- **"Different spelling" and "Artist name on label" are two controls in Figma.** The nested checkbox can't drive the `artist on label` boolean, so a designer sets both. Code ties them (credit shown when checked). Same for the label row (not a component).
- **Admin form mobile and Edit frames.** Not drawn: code collapses rows to one column; Edit = Create with "Update" and the status panel.
- **Admin status panel.** No Figma frame for sale states. Code (2026-11-10, BACKEND → Create side column, below SKU): read-only `Status` input (like SKU), optional `Status note` input, one secondary Button per allowed transition ("Mark as sold/traded", "Reserve", "Release", "Unpublish", "Make available again"). Listings table: Figma BACKEND → Listings (2026-11-10). Archived copies show only "Restore". Gio (2026-11-10): keep it as is, provisional until a Figma frame exists.
- **Sold / reserved on the storefront.** Not designed. Today the build hides non-available copies from the PLP, but the PDP of a sold or reserved copy is still built with "Add to bag". Needs: what a sold PDP shows (badge? CTA disabled? page kept for history, as in the product brief?) and how `site.js` updates CTAs live (`listing_availability` view is ready).
- **Fetch Discogs (admin).** Built as in Figma 2104:20728 (secondary button under `Discogs match`). Not designed: the loading state (code: label unchanged, `aria-busy`, "Reading Discogs…" in the status line; the disabled look would strike the label through) and the result/error feedback (code: the side status line). Open: `Discogs match` still uses `variant=search` (magnifier) while it is a paste field until text search exists → plain input, or keep it for the coming search.
- **Checkbox.** Ported (`controls` → `checkbox`, state default | active). Not designed: focus (code: browser ring on the box), disabled, error. Used by the admin "Different spelling" (Figma BACKEND → Create, 2026-11-10).
- **Pre-release on the shop.** Admin checkbox from Figma (2104:21454). The shop text is Gio's spec in chat (2026-11-10): "Pre" right after the label name in the product info line ("Black Ark Pre 7\" (JA)"), same style; not drawn in the PDP/PLP frames.
- **Listings (admin) not drawn.** Mobile layout; empty state of a tab (code: "No listings here." in the table); loading/busy state of the bulk buttons (code: `aria-busy`, label unchanged, no disabled look because disabled strikes the label through); sort and search. Bulk Publish skips the form validation (a draft without photos can go live): add a check if it bites.
- **Admin Attributes (0034).** Not designed: mobile, empty tab, sort, the admin navigation (code: header button "Attributes" next to "Listings"), the "Saved" message. Not built yet: the shop pages `/artists/<slug>` the slug is for.
- **Radio.** Ported (`controls` → `radio`, Gio 2026-11-10). Not designed: focus (browser ring), disabled, error. Used by `Dialog` `choices` (admin Attributes merge, 0034).
- **Dialog.** No destructive colour: the confirm button is primary, the label carries the meaning. Mobile: full width minus 16px each side (code), not drawn.
- **Admin shop preview (0030).** Not drawn: the empty state (code: no gallery until an image is added, empty title, the green block only); the admin on mobile (the side column comes first, so the preview sits above the form: move it below?); sold/reserved listings (the preview shows the copy as for sale). The side column now scrolls on its own when the preview makes it taller than the window (code choice, keeps Publish reachable). Naming: the action panel has a "Preview" button (opens the live shop page) and the section is also "Preview": rename one (e.g. button "View in shop")? Preview padding-bottom 24 is the PDP literal (see `PDP - mobile` below).
- **Button `layout` (hug | fill).** Not ported: the admin side buttons fill their column via the page layout.

## Accessibility risks

- **IconButton** is exactly 24px: needs ≥ 24px clear space from neighbouring targets.

## Figma to fix

- Variables: `white-0/4/8/16/24` → `white-a*` · `border divider/strong` → `border/divider/strong` · `small`, `medium-small` → `space/*`.
- `_button-sizes`: `size` options ordered large, medium, extra small, small → order by size. Unported `prefix` / `suffix` slots and single-value `active` axis.
- `icon button`: no instance-swap property on the icon · `state=disabled` background bound to `…/default` instead of `…/disabled`.
- `tab`: single-value `hierarchy`, unused `layout` variant.
- `tag group / orientation=vertical` is not vertical · `tag item` gap 8 with one child.
- `product info`: 8 text nodes with hardcoded `#000000` → `text/strong` · placeholder name "Artist 1 - Title 1 / Artist 2 - Title 2" needs a data model for split releases.
- `product card`: all 10 text nodes have unbound fills (`#000000`) → `text/strong` · button and product image descriptions say "Codice: .cw-button · ui_button()" / ".cw-product-image · ui_product_image()": not Zanza names (`zz-`, React `Button`), looks copied from another project → rewrite · product image description says 80×80 (here it is 249 / 109).
- `you may also like`: padding 8 and gaps 8 literal (→ `small` / `gutter/small`?) · name vs title: component "you may also like", copy "More for sale:" → rename the component `related products` (code: `RelatedProducts`) · mobile variant width 375 hug vs desktop fill: make both fill · a loose instance (2061:18468) sits on the PDP page outside any frame: delete if it's a leftover.
- `PDP - mobile` › `pdp content`: padding-bottom 24 literal, no token for 24 (scale has 8 / 16) → add one (e.g. `medium`) or use 16.
- `PLP - desktop`: content frame named `pdp content`, list frame `Frame 46`, card instances `Frame 43/44/45` → `plp content`, `product list`, `product card`.
- `header` mobile: store-name frame named `logo` (desktop: `store name`).
- `_input-master`: compact + filled has gap 2, every other variant 4 (code: 4) · `_input-master-support text` uses body/extra small (12/14) but its instances inside the master render body/small (14/16) (code: body-small) · error colour `#ff5d16` unbound (see Pending).
- `_input chips`: holds 2 visible + 2 hidden chips (instances can show up to 4); Figma has no slot API from plugins, so more chips = detach or add to the building block.
- BACKEND → Create: SKU `input` instance (2095:19818) has an unbound white fill. (Frames named, rows and × fixed when componentized, 2026-11-10.)
- Descriptions copied from another project: `button`, `_button-states`, `_button-sizes` ("Codice: .cw-button · ui_button()", `text/faint`, `icon/delicate`, sizes 40/32/22/18 that are not Zanza's) · icons `icon-x-ultra` and `hamburger-menu-ultra` described as "play audio campione…".
- `checkbox`: label text fill unbound `#000000` → `text/strong`; icons `icon-square` / `icon-square-tick` fill unbound black; component has no description.
- `player`: native-player placeholder fill unbound (placeholder only, fine).
- Icons: hamburger lines have a white stroke · `icon-pencil` uses unbound `#212121`.

## Code to do

- DS artifact (https://claude.ai/artifact/9Q7SAYDqDnBAj4MEKLnphz) not republished since the `--mobile` type variants: needs `npm run build:artifact` + publish.
- Component token tables in `docs/*/README.md` are still hand-written (API tables are generated).
