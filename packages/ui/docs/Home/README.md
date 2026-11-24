# SectionHead · GenreLinks · HomeIntro · HomeNewsletter · ProductTile · GalleryCounter · ViewToggle · CollectionCard · HomeCollections

The blocks of the home page, Home v2 (decision 0120, replaces 0085). Figma: page `Home` → section `components` (`section head`, `genre links`, `view toggle`, `home shelf`, `home intro`, `home newsletter`) and page `product card` (`product tile`, `gallery counter`). The storefront fills them in `apps/storefront/pages/home.js`.

- SectionHead: Divider on top (boolean `divider`), then the title (body/medium, text/strong) with an inline `meta` ("(12)", text/moderate) and the actions on the right (secondary Buttons); gap small, top-aligned.
- GenreLinks: Tag size=large links, then "All" (Button secondary extra-small) on its own line, gap small. No title (Gio 2026-11-18): a `<nav aria-label="Genres">`. layout column (desktop side) | row (mobile, wrapping).
- HomeIntro: the welcome line, body/extra-large on desktop, body/large on mobile; its link is underlined.
- HomeNewsletter: 16 above and below, a dashed box (1px divider/strong, 8 on / 8 off, as the header store name), padding medium-small, gap small: SectionHead + FooterNewsletter with the label hidden (kept as aria-label). Desktop width = 2 of the 3 tile columns (set by the page).
- ProductTile: media, title block, price row (price + samples), Button fill; gap small. Desktop shows the cover; mobile every photo in a horizontal scroll-snap gallery with a GalleryCounter 8px from the bottom-left corner (the page script updates it). Hover = surface/hover on the whole tile, pointer devices only.
- ViewToggle: a secondary Button whose label names the other view ("List view" with icon bars-three, "Grid view": its icon is still a placeholder in Figma, design/open.md).
- CollectionCard (decision 0174): a link box, label centered (label/large), 1px border divider/strong, padding medium-small, min height 96; hover = surface/hover. Focus = the browser ring (no focus token yet).
- HomeCollections (decision 0174): the cards under the intro, a `<nav aria-label="Collections">` with a list; the cards share the full width (2 cards = halves, 3 = thirds…), as many per row as fit at their minimum width: desktop 200, mobile 144 (always 2 per row on a phone); wrapped cards keep the column width (decision 0176). Gap gutter/small.
- Accessibility: shelves are `<section>`s named by their title; tiles are `<article>`s named by the product name (h3); the swipe gallery is part of the tile link; the counter is decorative (aria-hidden), the photos' alt is on the first one only.

## API

<!-- api: SectionHeadProps GenreLinksProps HomeIntroProps HomeNewsletterProps ProductTileProps GalleryCounterProps ViewToggleProps CollectionCardProps HomeCollectionsProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
### SectionHead

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `title` * | `ReactNode` |  | Figma `title` (body/medium, text/strong). |
| `meta` | `ReactNode` |  | Figma `meta text` (boolean `meta`): an inline count after the title, e.g. "(12)", text/moderate. Omit → none. |
| `headingLevel` | `2 \| 3 \| 4` | `2` | Heading level of the title. |
| `divider` | `boolean` | `true` | Figma boolean `divider`. |
| `actions` | `ReactNode` |  | Figma boolean `actions` (`play`, `see all`): secondary Buttons ("Play all", "See all"). Omit → no actions. |
| `titleId` | `string` |  | id of the title, to name the section (aria-labelledby). |

### GenreLinks

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `genres` * | `{ label: ReactNode; href: string }[]` |  | The genres, in order. |
| `layout` | `'row' \| 'column' \| 'responsive'` | `responsive` | Figma `layout`: row = wrapping, column = one per line; responsive = column on desktop, row on mobile. |
| `allHref` | `string` |  | "All" (Button secondary extra-small, own line): the link to every record (the shop: /sale/). Omit → no All. |
| `allLabel` | `ReactNode` | `All` |  |

### HomeIntro

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `device` | `'desktop' \| 'mobile' \| 'responsive'` | `responsive` | desktop = body/extra-large, mobile = body/large, responsive = both by breakpoint. |
| `children` | `ReactNode` |  |  |

### HomeNewsletter

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `title` | `ReactNode` |  | The SectionHead title. @default "Get new records first" |
| `headingLevel` | `2 \| 3 \| 4` | `2` |  |
| `device` | `'desktop' \| 'mobile' \| 'responsive'` | `responsive` | Figma `device`: the box width is set by the page (desktop: 2 of 3 tile columns; mobile: fill). |
| `children` | `ReactNode` |  | The form: a FooterNewsletter with `hideLabel`. |

### ProductTile

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `device` | `'desktop' \| 'mobile' \| 'responsive'` | `responsive` | desktop = the cover; mobile = every photo in a horizontal swipe gallery + counter; responsive = by breakpoint. |
| `state` | `'default' \| 'hover'` |  | Doc-only pin of the interaction state (hover comes from :hover on pointer devices). |
| `images` | `{ src: string; srcSet?: string; sizes?: string; alt?: string }[]` |  | The photos, cover first (1:1). |
| `href` | `string` |  | The product page: the media becomes its link. |
| `title` * | `ReactNode` |  | Figma `product name`. |
| `releaseInfo` | `ReactNode` |  | Figma `release info`. |
| `price` | `ReactNode` |  | Figma `price`. |
| `samples` | `ReactNode` |  | Figma `samples`: PlayerButtons, right of the price, wrapping. |
| `action` | `ReactNode` |  | Figma `button` (fill): e.g. a secondary Button "Add to bag". |
| `counter` | `boolean` | `true` | Figma boolean `counter`: the gallery counter on mobile, shown only with more than one photo. |
| `headingLevel` | `2 \| 3 \| 4` | `3` |  |

### GalleryCounter

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | `ReactNode` |  | Figma `count`, e.g. "1/3". |

### ViewToggle

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `view` | `'grid' \| 'list'` | `grid` | The view shown now: grid → "List view" (icon bars-three); list → "Grid view" (icon: TODO in Figma). |

### CollectionCard

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` * | `ReactNode` |  | The collection name (label/large, uppercase by the type style). |
| `state` | `'default' \| 'hover'` |  | Figma `state`, for docs only; the page uses :hover. |

### HomeCollections

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `collections` * | `{ label: ReactNode; href: string }[]` |  | The cards, in Gio's order (admin → Collections). |
| `device` | `'desktop' \| 'mobile' \| 'responsive'` | `responsive` | desktop = 4 per row, mobile = 2 per row, responsive = by breakpoint. |

`*` required.
<!-- /api -->
