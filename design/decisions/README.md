# Design decisions

One file per decision, numbered, append-only. This is the record of **why** the system is the way it is; the code and Figma show **what** it is.

- **Never rewrite** an accepted decision. To change it, add a new one and mark the old `superseded by NNNN`.
- **Rule** is the line that gets applied to new components and pages. Write it as an instruction.
- No token values in a decision: name the tokens, the values live in `tokens.json`.
- Open questions and parked gaps are not decisions: they live in [`../open.md`](../open.md) until they are decided.

## Template

```md
# NNNN — Title

`YYYY-MM-DD` · accepted | superseded by NNNN · Figma: <node or —>

**Context.** What forced the choice (one or two sentences).
**Decision.** What was chosen.
**Rule.** The instruction to apply from now on.
**Where.** Files / components that implement it.
```

## Index

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-figma-decides.md) | Figma decides; code never invents visuals | accepted |
| [0002](0002-token-naming-and-tiers.md) | Token naming and three tiers | accepted |
| [0003](0003-type-styles-are-classes.md) | Text styles are classes that carry the sizes | accepted |
| [0004](0004-one-breakpoint-in-tokens.md) | One breakpoint, defined only in tokens.json | accepted |
| [0005](0005-border-pattern-carries-state.md) | The border pattern carries the interaction state | accepted |
| [0006](0006-figma-strokes-are-inside.md) | Figma strokes are inside: padding minus border | superseded by 0014 |
| [0007](0007-floating-actions-foreground-background.md) | Chromeless controls: floating foreground + background | accepted |
| [0008](0008-building-blocks-stay-internal.md) | `_` building blocks stay internal; nested props become flat props | accepted |
| [0009](0009-interaction-state-from-pseudo-classes.md) | Interaction states come from pseudo-classes; `state` is doc-only | accepted |
| [0010](0010-sticky-header-is-site-behaviour.md) | Sticky header is site behaviour, not a component prop | accepted |
| [0011](0011-mobile-gallery-bleed.md) | Mobile gallery bleeds into the page margins | accepted |
| [0012](0012-layout-mirrors-figma-grid.md) | Layout is CSS grid mirroring Figma grid auto layout | accepted |
| [0013](0013-docs-structure.md) | Docs: decision log, one backlog, API generated | accepted |
| [0014](0014-strokes-included-in-layout.md) | Strokes included in layout: CSS border + full Figma padding | accepted |
| [0015](0015-persistent-player.md) | Persistent player: native audio + soft navigation | accepted |
| [0016](0016-one-markup-blocks-placed-by-grid.md) | One markup per component; blocks moved between variants are placed by CSS grid | accepted |
| [0017](0017-figma-modes-are-themes.md) | Figma modes are themes on `[data-theme]` (frontend, backend) | accepted |
| [0018](0018-form-fields-map-to-the-platform.md) | Form fields: Figma states map to native state; props go to the control | accepted |
| [0019](0019-entity-suggestions-are-native.md) | Artist and label suggestions use the native datalist | superseded by 0020 |
| [0020](0020-entity-fields-are-chip-inputs.md) | Entity fields are chip inputs (the `input` with chips) | accepted |
| [0021](0021-sample-title-defaults-to-line-title.md) | The sample title defaults to its line title | accepted |
| [0022](0022-one-sample-per-line.md) | One sample per line | accepted |
| [0023](0023-surface-accent-and-opaque-base.md) | `surface/accent` is the page; `surface/base` is opaque white | accepted |
| [0024](0024-delete-drafts-archive-the-rest.md) | Delete drafts, archive the rest; bulk actions act where allowed | partly superseded by 0025 |
| [0025](0025-every-bulk-action-confirms-delete-any.md) | Every bulk action asks first; any listing can be deleted | accepted |
| [0026](0026-admin-blocks-are-components-layout-stays-frames.md) | Admin blocks are components; layout stays frames | accepted |
| [0027](0027-first-line-is-four-plus-four.md) | Line 1 is 4 + 4 columns, lines 2+ are 3 + 4 | accepted |
| [0028](0028-plp-filters.md) | PLP filters: facets from the data, plain text, OR inside / AND between | accepted |
| [0029](0029-counts-are-suffixes.md) | A count next to a label is the component's suffix | accepted |
| [0030](0030-admin-shop-preview.md) | The admin shows a live shop preview, built from the shop's components | accepted |
| [0031](0031-subgenres-and-tags.md) | Subgenres (Discogs styles) and tags (the shop's own) are separate | accepted · names changed by 0048 |
| [0032](0032-create-page-on-surface-base.md) | The create / edit page is on `surface/base` | accepted |
| [0033](0033-pdp-gallery-scrolls-on-its-own.md) | PDP desktop gallery: images stacked, the column scrolls on its own | partly superseded by 0036 (not sticky) |
| [0034](0034-attributes-page.md) | Attributes: one admin page for artists, labels, subgenres and tags; removing a used one goes through Replace with | accepted |
| [0035](0035-media-graded-per-side.md) | The record is graded per side: `VG+ / VG`, side B optional | accepted |
| [0036](0036-pdp-gallery-moves-with-the-page.md) | PDP desktop gallery moves with the page and fits the window at rest | accepted |
| [0037](0037-record-and-cover-grade-lines.md) | Grading reads `Record: …`, plus `Cover: …` when the cover is graded | accepted |
| [0038](0038-mobile-filters-layer.md) | Mobile filters: full-screen layer, nested levels, draft until Apply; sort is a native select | accepted |
| [0039](0039-mobile-card-image-max-96.md) | Mobile product card: the image column is at most 96px | accepted |
| [0040](0040-card-title-links-to-pdp.md) | The product card title links to the product page | accepted |
| [0041](0041-plp-active-filter-replaces-breadcrumbs.md) | PLP: no breadcrumbs, only the filter reached from a link (artist, label, subgenre, tag) | accepted |
| [0042](0042-conditions-comment-own-line.md) | The stacked conditions comment is its own line, 4px from the cover grade like every line of the block | accepted |
| [0043](0043-hover-only-with-a-pointer-no-autofocus.md) | Hover only where the device hovers; nothing is focused on page or layer open | accepted |
| [0044](0044-bag-is-a-page.md) | The bag is a page; one line per copy; adding does not hold | accepted |
| [0045](0045-button-active-is-the-current-page.md) | Button `active` = the current page: a link with aria-current, never disabled | accepted |
| [0046](0046-added-to-bag-label.md) | A copy in the bag: its Add buttons read "Added to bag" and open the bag | superseded by 0054 |
| [0047](0047-added-to-bag-tick.md) | "Added to bag" carries a tick as its trailing icon | superseded by 0054 |
| [0048](0048-macro-genre-and-genre.md) | Genre = the Discogs style (was "subgenre"); the Discogs genre is the macro genre, not shown | accepted |
| [0049](0049-toast-feedback.md) | Toasts carry Undo and off-screen news; everything else stays inline | accepted, amended by 0050, 0052, 0053, 0071 (top) |
| [0050](0050-added-to-bag-toast.md) | Add to bag shows a toast too; an action that is also on the page lets the toast time out | accepted |
| [0051](0051-toast-dashed-border.md) | The toast border is dotted: dashed [1,1] | superseded by 0053 |
| [0052](0052-toast-clear-of-rounded-corners.md) | On mobile the toast sits 2 × medium-small above the bottom, plus the safe area | superseded by 0055 |
| [0053](0053-toast-border-dash-16.md) | The toast border is dashed [16,16], like the drop zone | accepted |
| [0054](0054-in-bag-add-becomes-remove.md) | A copy in the bag: its Add buttons read "Remove" and take it out | superseded by 0058 |
| [0055](0055-toast-mobile-gap-16.md) | On mobile the toast sits medium-small above the bottom, or the safe area if larger | superseded by 0071 |
| [0056](0056-player-sample-number-is-queue-position.md) | The player's sample number is the sample's position in the queue | accepted |
| [0057](0057-shipping-estimate.md) | Shipping: rate tables, max records per package, an estimate in the bag by country | accepted |
| [0058](0058-in-bag-opens-the-bag.md) | A copy in the bag: its Add buttons become "In bag" (secondary + tick) and open the bag | accepted |
| [0059](0059-reserved-opens-notify-me.md) | A reserved copy reads "Reserved" (secondary + clock), stays active, opens the Reserved dialog with Notify me | accepted |
| [0060](0060-mobile-menu.md) | Mobile menu: a full-screen layer from the hamburger, Account is its entry point | accepted |
| [0061](0061-search-results-page.md) | Search: a results page that is a PLP; sold copies stay visible behind "Show sold out" | accepted |
| [0062](0062-search-field-clear-and-submit.md) | Search field: the magnifier submits, a × clears while there is text; on mobile the field is in the menu | accepted |
| [0063](0063-input-focus-ring-on-the-field.md) | Input focus: the ring goes around the whole field, not the native control inside it | accepted |
| [0064](0064-sold-line-in-the-bag.md) | A sold copy in the bag: name struck through, "SOLD OUT" beside the struck price, a note above Checkout | accepted |
| [0065](0065-reserved-button-notify-me.md) | Reserved: Add button "(Reserved) Notify me" with an envelope; the bag line looks like a sold one | accepted |
| [0066](0066-icons-are-non-scaling-strokes.md) | Icons are 1px strokes that keep their thickness at any size | accepted |
| [0067](0067-text-moderate-meets-aa.md) | `text/moderate` is black at 56%: 4.5:1 or more on every ground it sits on | accepted |
| [0068](0068-trade-is-a-conversation.md) | Trade: "not for sale, convince me"; the offer page asks for an introduction and starts a conversation, no shipping rule | accepted |
| [0070](0070-traders-prove-their-profiles.md) | Traders give Discogs + Instagram or Facebook and prove them by sending Gio a two-word password from each; the conversation stays by email | accepted |
| [0069](0069-which-record-searches-discogs.md) | "Which record" in the offer form searches Discogs releases while typing and accepts release links; plain text stays possible | accepted |
| [0071](0071-toasts-at-the-top.md) | Toasts sit at the top: below the visible sticky header, top-right on desktop, full width on mobile | accepted |
| [0072](0072-minimum-order.md) | Minimum order: records only (shipping excluded), set in admin Shipping; the bag says what is missing and Checkout waits, described by the note | accepted |
| [0073](0073-genre-tag-chip-shows-the-value.md) | PLP genre / tag chip shows only the value; the type stays in the remove button's accessible name | accepted |
| [0074](0074-bag-item-gap-matches-product-card.md) | Bag item row gap = ProductCard column gap (`gutter/small`), in Figma and code | accepted |
| [0075](0075-ship-to-lists-served-countries.md) | Bag "Ship to" lists only the countries in a zone with rates, derived from the shipping config | accepted |
| [0076](0076-footer.md) | Site footer: newsletter slot (off until Privacy names Buttondown), the mobile menu's links, Instagram/Discogs, legal + copyright; same tokens as the header | accepted |
| [0077](0077-blocking-message-in-a-red-box.md) | A message that blocks an action or changes the order (minimum, sold out lines) sits in a red box (`alert`); new tokens `red` + `surface/alert` | accepted |
| [0078](0078-unavailable-name-in-red.md) | Bag: SOLD OUT / RESERVED in an inline red `alert`; record name plain, no strikethrough | accepted |
| [0079](0079-legal-pages.md) | Legal pages (Impressum, Privacy, Terms, Withdrawal, Shipping): one text template, text in `content/legal/*.md`, Gio's data in `site.json` → legal; Inter self-hosted | accepted |
| [0080](0080-one-icon-per-name.md) | One icon per name: the "-ultra" drawings replaced the originals and took their names; no suffixed copies (amended: icon-bars-three, code re-aligned with Figma icons) | accepted |
| [0081](0081-select-ring-for-keyboard-only.md) | SelectButton (Sort): the focus ring shows for keyboard focus only; after a mouse pick focus stays, the ring hides | accepted |
| [0082](0082-year-or-decade.md) | Year field takes an exact year or a decade ("1990s"): `year` stays a number, `year_precision` = year / decade | accepted |
| [0083](0083-view-in-store-button.md) | Admin action panel: the button that opens the live shop page reads "View in store"; "Preview" names only the in-admin shop preview | accepted |
| [0085](0085-home-page.md) | Home page: Just in (8 newest, sale and trade mixed, Play all), Genres, About; PLP grid on desktop, Genres on top on mobile; store name lit as the current page (amended 2026-11-15) | superseded by [0120](0120-home-v2.md) |
| [0086](0086-sold-out-cross.md) | Sold-out images: tried cross / label / greyscale, rolled back: a sold copy's images look like an available one's (text says sold). Player Add to bag reads "Sold out" for a sold copy | accepted |
| [0087](0087-admin-memo.md) | Admin Memo: Gio's list of records to sell later (free text or a Discogs release), mobile-first rows; Create listing from a memo fetches the release and takes it off the list | accepted |
| [0088](0088-product-card-hover.md) | Product card hover: the whole card takes the new `surface/hover` (= black-a4); Figma `product card` state=default/hover | accepted |
| [0089](0089-admin-mobile.md) | Admin on mobile: AdminBar + menu dialog (MenuLayer), ListingRow instead of tables, bulk bar and form actions (ActionBar) sticky at the bottom, Shipping fields stacked, 44px tap areas on touch | accepted |
| [0090](0090-photo-of-the-label.md) | Memo: "Photo of the label" reads the label with a free vision model (Cloudflare Workers AI), the text lands in Record and searches Discogs by barcode, cat. no., then artist + title; the photo is never stored | accepted |
| [0091](0091-progress-bar.md) | ProgressBar (4px, black on surface/subtle); Memo photo shows an estimated progress that eases and never claims 100 % early | accepted |
| [0092](0092-photo-in-create.md) | Create listing: Photo of the label beside Fetch Discogs; a release picked from the photo goes into Discogs match and is fetched | accepted |
| [0093](0093-private-seller-slim-legal.md) | Private seller: no Impressum or Withdrawal, /contact/ = email + form, one-screen Privacy, Terms = a few lines on private sale | accepted |
| [0094](0094-header-logo-only-when-it-fits.md) | Header: the logo shows only when menu + logo + store name + actions fit in the row (measured, Figma boolean `logo`); the store name always stays | accepted |
| [0095](0095-mobile-breakpoint-960.md) | Mobile layout below 960px (was 768): the desktop header needs ~910px even without the logo, so 768–910px scrolled sideways | proposed |
| [0096](0096-coming-soon-page.md) | Coming-soon page on rythem-works.com (store name, Opening soon, text, newsletter, Contact/Privacy/Terms) while the shop is on staging behind a login; noindex everywhere until launch | accepted |
| [0097](0097-favicon-logo.md) | Favicon = the logo illustration on shop, admin and coming-soon; SVG inverts in dark mode, white square only for the iOS icon | refined by 0127 |
| [0098](0098-checkout-thanks-and-returns.md) | Checkout: /checkout/thanks/ (layout of the empty bag, Figma `order thanks`, no order details: they are in the email); cancel and failures are toasts in the Bag | accepted |
| [0099](0099-admin-page-ground-cream.md) | Every admin page on cream: primitive `scotch-mist` #fdfbdd, semantic `surface/page` (frontend accent, backend scotch-mist) on html / screen frames | accepted |
| [0100](0100-admin-orders-and-sell-again.md) | Admin Orders (#orders: To ship / Shipped / All; order page with Ship to, Total, Buyer, Payment; Mark as shipped + tracking) and Sell again (twin draft listing of a sold copy, same release, new SKU) | accepted |
| [0101](0101-customer-account.md) | Customer account = the verified email: sign in with a 6-digit code, orders found by email (guest ones too), only emails with orders; /account/, /account/order/, /account/details/ | accepted |
| [0102](0102-trade-switch.md) | Trade switch (admin → Settings, `shop_settings.trade_enabled`): off = no trade page, link, record, legal passage or mention; the server refuses offers | accepted |
| [0103](0103-newsletter-own-double-opt-in.md) | Newsletter: our own double opt-in (Supabase `newsletter` + Resend + Buttondown API), signup answers in place, one click in the email confirms on /newsletter/confirm/; Buttondown's form stays as fallback | accepted |
| [0104](0104-space-above-footer.md) | Space above the site footer: `dimension/footer-gap` (96px) as the footer's padding-top, above its top border, desktop and mobile; pages add no room for it | accepted |
| [0106](0106-admin-content.md) | Admin Content (#content): About you (profile), Pages (sections in page order), Short texts (plain), one Save per block → rebuild; interface text stays in code; Settings → Who I am off = Store profile, no personal info, trade off. 0105 skipped (used by the reverted #151) | accepted |
| [0107](0107-admin-bulk-create.md) | Admin Bulk create (#bulk): files named record_role grouped per record, label read by the AI → Discogs, overview with states + review one by one (Next / Skip), Create N drafts; drafts may be incomplete (migration 0026), checked on publish | accepted |
| [0108](0108-photo-sizes-and-light-samples.md) | Photo sizes and lighter samples, made in the admin at upload: copies 200/400/800 next to each 1600 photo (`photos/<uuid>-w400.webp`, list in `packages/images`), srcset + sizes on the shop only for photos whose copies the build found; Settings → Make photo sizes for older photos; mp3 above ~160 kbps → 128 kbps (lamejs) | accepted |
| [0109](0109-upload-progress.md) | Upload progress: real ProgressBar per file (Create) and per record (Bulk) while a sample converts (0–60 %) and uploads (60–100 %); the phase in words; a sample left at its bitrate is always reported | accepted |
| [0110](0110-sample-clip.md) | Clip a sample: Length Full / Clip 30s / 60s / 90s in the Samples overview; cut in the browser from 0:00, hard cut (no fade), 128 kbps, new file; play previews the clip; Full restores | accepted |
| [0111](0111-custom-title-from-discogs.md) | Custom title: From Discogs button under the field (only with a Discogs release) fills "Artist - Title" from Discogs; the shop links the release artists found in any custom title (derived, not stored) | accepted |
| [0112](0112-short-slugs.md) | Slugs at most 80 characters, cut at a word (slugify, migration 0027): a compilation slug of 300+ characters broke every shop build | accepted |
| [0113](0113-create-sections-and-fetch-from-label.md) | Create listing: section nav (desktop left column nav 2 + main 7 + side 3, mobile sticky row), a heading per section, Discogs + Images first, Custom title in Artist & title, Fetch from label reads the listing images in order | accepted |
| [0114](0114-markers-and-price-block.md) | Create listing: a `Marker` circle draws the eye to a block (line number in ListingLine, "€€" in PriceFields, 0 gap to the fields); Label and Price split into two sections (Price = Sale type + Price) | accepted |
| [0115](0115-pdp-gallery-every-photo.md) | PDP gallery and admin preview show every photo, cover first; one photo is shown once (no more repeating the cover as copy photo) | accepted |
| [0116](0116-checkout-first-to-pay.md) | Checkout holds nothing: Stripe authorizes, the first paid session gets the copies (captured), the others are cancelled and never charged; "Reserved" only for manual holds | accepted |
| [0117](0117-no-section-nav.md) | Create listing: the section nav (anchor links on the left, 0113) is removed in Figma and code; headings, order, markers and Price block stay; layout back to main 8 + side 4 | accepted |
| [0118](0118-listing-status-and-save-feedback.md) | Create / Edit listing: `listing status` at the top of the side column (status, when, SKU, Unsaved changes, shop update), toast after a save, errors in an Alert, `change status` replaces the read-only Status field | accepted |
| [0119](0119-pdp-sticky-scroll.md) | PDP desktop: gallery and record anchor 8 below the header, "More for sale" (12 records, title band anchored, "View all for sale" at the end) scrolls over them; `product return card` on the gallery takes you back | accepted |
| [0120](0120-home-v2.md) | Home v2: welcome line, genres + grid/list toggle, "This week (n)" and "Recent" shelves of 6 sale records around a dashed newsletter box; mobile = full-width tiles with a swipe gallery; replaces 0085 | accepted |
| [0121](0121-newsletter-dialog-and-gallery-peek.md) | Newsletter links open a newsletter dialog instead of scrolling; mobile swipe galleries (PDP, home tiles) show the next photo; no tile counter on the home; mobile intro 16/16; staging ✎ links removed | accepted |
| [0122](0122-pdp-breadcrumbs-section-genre.md) | PDP breadcrumbs = section / genre, both links (genre → `?genre=`); no format, no current-page item, no macro-genre fallback; "/" inside the item | accepted |
| [0123](0123-admin-list-thumbnails.md) | Admin lists (Listings table + mobile rows, order records) show the first photo as a 40 × 40 `Thumbnail` (200 px copy), empty square without a photo; backend `surface/support-1` = black-a8 as in Figma | accepted |
| [0124](0124-image-placeholder-surface-media.md) | Record images (cards, tiles, thumbnails, gallery, player, bag, return card, admin photos) sit on new `surface/media` = black-a4 while loading or empty, no more light blue; `surface/support-1` is tags and chips only | accepted |
| [0125](0125-create-actions-on-listings.md) | Create listing and Bulk create leave the admin bar (desktop nav, mobile bar, menu) and become actions of the Listings page (`ListingsHead`); #new / #bulk mark Listings as the current section | accepted |
| [0126](0126-home-view-toggle-in-shelf-head.md) | Home grid / list toggle moves from the side column into each shelf head, between Play all and See all (desktop only, still switches every shelf) | accepted |
| [0127](0127-favicon-per-environment.md) | Favicon ground per environment from Figma component `favicon` (logo in multiply): live white, staging acid-green, admin negative (black ground, white logo); shop picks staging/live by host (`site.json` → `liveHosts`) | accepted |
| [0128](0128-listings-tabs-and-search.md) | Admin Listings: tabs Live · Drafts · Sold · Archived (no All, Live default; reserved in Live, traded in Sold) + `ListingsFilter` search (SKU, name, label; case and accent insensitive) that narrows every tab and its count | accepted |
| [0129](0129-manual-listing-order.md) | Manual order: `listings.sort_order` set by drag & drop in admin Listings (`useDragOrder` + `DragHandle`, FileList's logic), one global order filtered by every tab and shop list; new and published-from-draft go on top; home shelves stay by date | accepted |
| [0130](0130-privacy-legal-minimum.md) | Privacy at the legal minimum (GDPR Art. 13): one bullet per processing (data, provider, basis, retention), generic (provider categories, no names, no controller name: accepted risk), one transfers line, rights | accepted |
| [0131](0131-cookieless-analytics.md) | Shop analytics = PostHog EU, cookieless (nothing on the device, no banner): page views, sources, heatmaps, web vitals, named events (search, filters, samples, bag, checkout…) and `template` on every event; no recordings; never on the admin | accepted |
| [0132](0132-contact-form-proof-of-work.md) | Contact form bots: invisible proof of work (signed puzzle from the function, solved in the background), honeypot, 3 s time trap; no cookies, no third party, no visible widget | accepted |
| [0133](0133-weekly-dispatch-wednesday.md) | Dispatch at least once a week, usually Wednesday: full rule (paid by Tuesday → Wednesday, never more than a week) on the Shipping page, one line after paying (thanks, email, Account); nothing before paying; no admin setting | accepted |
| [0134](0134-terms-and-shipping-generic.md) | Terms and Shipping like Privacy: minimal, no provider names, no unconfirmed numbers, no links to missing pages; no placeholders left | proposed |
| [0135](0135-memo-create-draft.md) | Memo: Create draft in one tap (no form): release fetched as Fetch Discogs, free text = line 1; memo leaves the list, toast with Open | accepted |
| [0136](0136-file-names-for-scans-and-clips.md) | File names `<sku>_<role>_<slug>` (roles of Bulk, slug = what is in the file, ignored by the parser); Edit listing side → File names with Copy (name without extension) | accepted |
| [0137](0137-label-scanner-app.md) | Label scanner: macOS app (SwiftUI + ImageCaptureCore): fast preview of the 7" zone, turnable square, name typed or pasted (admin File names → Copy all), auto-save to a chosen folder, format + resolution | accepted |
| [0138](0138-scanner-v2-admin-drafts-and-fluid-turn.md) | Scanner v2: sign in, pick an admin draft, image list (position = role = file name, drag to reorder renames files), proxy for fluid drag/turn, orientation glyph + guide lines + angle badge, arrow-key nudge | proposed |
| [0140](0140-memo-bulk-actions.md) | Memo bulk: checkbox per row, Select all, Listings bulk bar; Create drafts (one at a time, reuses 0135) and Remove (Undo), both confirmed | accepted |
| [0141](0141-scanner-samples-tab.md) | Scanner Samples tab: Zoom session copied (SD never written), clips dragged onto draft clip slots, preview with optional trim, export WAV + MP3 320 with ID3 + side label cover; no normalization (parked); one drafts column (full list, filter, media icons) for Scans and Samples | proposed |
| [0142](0142-scanner-push-to-admin.md) | Scanner Push to admin: button next to the SKU (push / pushing / synced / failed), uploads scans (WebP + sizes) and clips (MP3 128) via sign-upload, `scanner-push` attaches them to the draft; asks before replacing what the admin has | proposed |
| [0143](0143-scanner-background-jobs.md) | Scanner background jobs: export and push queued, keep running when another SKU is selected; progress on the draft row (`job progress`) and in a bottom `activity bar` | proposed |
| [0144](0144-scanner-automatic-export.md) | Scanner: clip export automatic (files mirror the assignments, rewritten on label scan / trim / swap); media chips red / orange (started) / green (complete); tokens orange, surface-warning, text-on-warning | proposed |
| [0145](0145-scanner-new-draft.md) | Scanner New draft: search Discogs in the drafts column, one click creates the draft (same mapping as Memo, moved to `packages/listing-draft`, Edge Function `scanner-draft`); warns when the release is already listed | proposed |
| [0146](0146-admin-back-to-list-file-names-removed.md) | Admin: Back link to the Listings tab that holds a listing (`#listings/<tab>`); File names / Copy section removed (the Scanner names files now, 0145), FileNameRow dropped, BackLink added | proposed |
| [0147](0147-custom-title-links-by-hand.md) | Custom title links set by hand: LinkedInput (select → bar with Link artist / Clear link, never takes the focus; ⌘K menu), links = character ranges in `listings.custom_title_links` (migration 0031); From Discogs pre-links the lines' artists; no help text | accepted |
| [0147](0147-scanner-free-scans.md) | Scanner: deselect the draft (× / Esc / click again) → Free scan: dated editable name scan_<date>_<time>, never overwrites, saved in a Free scans subfolder, session list; no push / clips without a draft | proposed |
| [0149](0149-scanner-toast-undo.md) | Scanner: every removal (scan, free scan, clip slot, WAV, session clip, Clear session) shows the DS toast with Undo (and ⌘Z), no confirm; Undo restores the files from the Trash and the app state; ~6 s, a new one replaces it; top right; VoiceOver announcement; errors inline | proposed |
| [0150](0150-admin-discogs-link.md) | Admin Create / Edit listing: "On Discogs ↗" link (`DiscogsLink`, Figma `discogs link`) under Discogs match, in every status, new tab, while the field holds a release | accepted |
| [0151](0151-backend-tags-light-blue.md) | `surface/support-1` light blue in the backend too: admin tags and chips as in the shop (0123 had made them black-a8) | accepted |
| [0152](0152-scanner-label-crop-by-record-size.md) | Scanner: label crop by record size, 7" = 3.5" (88.9 mm), 10" / 12" = 4" (101.6 mm); one value in `SizePreset.labelMM` | accepted |
