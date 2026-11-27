import type { AnchorHTMLAttributes, ButtonHTMLAttributes, CSSProperties, HTMLAttributes, InputHTMLAttributes, ReactNode, Ref, SVGAttributes } from "react";

/** Mirrors the Figma component `button` — variants hierarchy × size, states via pseudo-classes. */
export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Visual weight. Figma: `hierarchy`. @default "primary" */
  hierarchy?: "primary" | "secondary";
  /** Figma: `size`. large = 46px, medium = 38px, small = 32px, extra-small = 24px (border included). @default "medium" */
  size?: "large" | "medium" | "small" | "extra-small";
  /** Native disabled; also drives the disabled visual state. */
  disabled?: boolean;
  /** Icon slot before the label. Pass an <svg>; it is sized and colored by the button. Figma: `leading icon`. */
  leadingIcon?: ReactNode;
  /** Icon slot after the label. Figma: `trailing icon`. */
  trailingIcon?: ReactNode;
  /** Text before the label, same text style, gap 4, e.g. "(Reserved)" before "Notify me" (0065). Figma: `prefix`. Say it in `aria-label` too if it carries meaning. */
  prefix?: ReactNode;
  /** Text after the label, same text style, gap 4: a count ("(3)", "21"), never concatenated into the label (0029). Figma: `suffix` + `suffix text`. */
  suffix?: ReactNode;
  /** Label text. Rendered uppercase by the label text style. Omit for an icon-only button — then `aria-label` is required. */
  children?: ReactNode;
  /** hover / pressed / disabled: documentation only, pins a visual state regardless of pointer.
   *  "active" is real (Figma state=active): the button stands for the current page (header Bag on /bag/). It renders
   *  aria-current="page" and stays focusable — pass `href`, never `disabled` (decision 0045). */
  state?: "default" | "hover" | "pressed" | "disabled" | "active";
  /** When set, renders an <a> styled as the button (navigation). */
  href?: string;
}

export declare function Button(props: ButtonProps): JSX.Element;

/** One item of the pagination: from packages/pagination (pagination.js → items). */
export interface PaginationItem {
  kind: "previous" | "page" | "current" | "gap" | "next";
  /** The page the item links to (none for "gap"). */
  page?: number;
  /** Where the item shows: both, or one device (desktop shows the current page's neighbours, mobile does not). */
  devices: Array<"desktop" | "mobile">;
}
/** Mirrors the Figma component `pagination` (device × position) + `_pagination gap` (decision 0179). A <nav> of
 *  secondary Buttons: the current page is state="active" (aria-current="page", 0045); Previous / Next only when there
 *  is a page to go to, never disabled. Desktop fluid (pages and gaps share the width), mobile 38 × 38 squares. */
export interface PaginationProps extends HTMLAttributes<HTMLElement> {
  /** The items to show, from packages/pagination `items(current, total)`. */
  items: PaginationItem[];
  /** The link of page n. @default n => "?page=" + n */
  href?: (page: number) => string;
  /** Accessible name of the nav. @default "Pages" */
  "aria-label"?: string;
}
export declare function Pagination(props: PaginationProps): JSX.Element;

/** Mirrors the Figma component `header` (device=desktop | mobile). A composition of logo, store name, Tabs and actions. */
export interface HeaderProps extends HTMLAttributes<HTMLElement> {
  /** Which Figma variant to render. Omitted → responsive: one markup, CSS switches menu/tabs/logo size (breakpoint `--mobile` from tokens.json, <768px placeholder). */
  device?: "desktop" | "mobile";
  /** The wordmark, usually <Logo /> (Figma: `logo` instance, decision 0183). 64 tall on desktop, 48 on mobile, width from its ratio; shrinks in width when the row is short of room. With a logo the store name is visually hidden (it stays the link's accessible name). */
  logo?: ReactNode;
  /** Store name (from `site.json` → storeName). Without `logo` it shows in the bordered label box (Figma `store name`, deprecated); with `logo` it is the home link's accessible name only. */
  storeName?: ReactNode;
  /** When set, logo + store name become ONE link to this URL (decision 0175): one tab stop, named by the store name. */
  homeHref?: string;
  /** Figma `store name` state=active: the page is the home page. Lit like the active tab; aria-current="page" on the home link, which stays clickable (the storefront reloads the page). */
  homeCurrent?: boolean;
  /** A <Tabs> element. Rendered on desktop only (Figma: no tabs in the mobile variant). */
  tabs?: ReactNode;
  /** Trailing actions, usually secondary <Button>s (Figma: `trailing actions`, gap 8). */
  actions?: ReactNode;
  /** Figma boolean `search` (desktop): the search field, usually a <form role="search"> with an <Input variant="search">. Rendered 280px wide before `actions`. */
  search?: ReactNode;
  /** Figma boolean `search` (mobile): the magnifier Button links here (the search page). */
  searchHref?: string;
  /** Mobile only: accessible name of the magnifier Button. Default "Search". */
  searchLabel?: string;
  /** Mobile only: click handler of the hamburger button. */
  onMenuClick?: () => void;
  /** Mobile only: accessible name of the hamburger button. Default "Menu". */
  menuLabel?: string;
  /** Mobile only: extra attributes of the hamburger button (aria-controls, aria-haspopup="dialog", aria-expanded). */
  menuProps?: Record<string, unknown>;
}
export declare function Header(props: HeaderProps): JSX.Element;

/** Mirrors the Figma component `logo` (page assets): the HIGHMUZIK wordmark, inline SVG 290 × 87, fill currentColor, aria-hidden (decision 0183). Size it with CSS height; name it on the link or heading around it. */
export interface LogoProps extends SVGAttributes<SVGSVGElement> {}
export declare function Logo(props: LogoProps): JSX.Element;

/** Mirrors the Figma component `tab group`: a horizontal tablist, gap 8. Owns the selection. */
export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** The `value` of the selected Tab. Controlled. */
  value: string;
  /** Called with the `value` of the Tab the user picks (click or ← → Home End). */
  onValueChange?: (value: string) => void;
  /** `"nav"` when the tabs are site navigation (links with href): no tablist semantics, no keyboard roving. */
  as?: "nav";
  /** <Tab> elements. */
  children: ReactNode;
}
export declare function Tabs(props: TabsProps): JSX.Element;

/** Mirrors the Figma component `tab`. Active iff parent Tabs.value === value (Figma: state=active). */
export interface TabProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "value"> {
  /** Identity of this tab inside its Tabs. */
  value: string;
  /** When set, renders an <a> (site navigation) with aria-current="page" if selected, instead of role="tab". */
  href?: string;
  /** Label text. Rendered uppercase by the label text style. */
  children: ReactNode;
  /** Icon slot before the label (20px). Figma: `leading icon`. */
  leadingIcon?: ReactNode;
  /** Icon slot after the label (20px). Figma: `trailing icon`. */
  trailingIcon?: ReactNode;
  /** Figma `_tab-sizes` size. extra-small = padding 4, label/extra small, 24px (account nav, decision 0101). @default "medium" */
  size?: "medium" | "extra-small";
  /** Text after the label, same style, gap 4: a count ("Artists" + 64). Figma: `suffix` + `suffix text`. */
  suffix?: ReactNode;
  /** Documentation only: pins a visual state regardless of pointer/selection. */
  state?: "default" | "hover" | "pressed" | "active";
}
export declare function Tab(props: TabProps): JSX.Element;

/** Mirrors the Figma component `breadcrumbs`: body-medium items separated by "/", 1px rule below. */
export interface BreadcrumbItem {
  /** Item text. */
  label: ReactNode;
  /** Link target; omitted or null = plain text. A last item without href is the current page (aria-current="page"). */
  href?: string | null;
}
export interface BreadcrumbsProps extends HTMLAttributes<HTMLElement> {
  /** In order. Items without a label are dropped. The last item is the current page only when it has no href (0122). */
  items: Array<BreadcrumbItem | string>;
}
export declare function Breadcrumbs(props: BreadcrumbsProps): JSX.Element;

/** Mirrors the Figma component `active filter` (PLP only, decision 0041): the filter reached from a link, in place of the breadcrumbs. */
export interface ActiveFilterProps extends HTMLAttributes<HTMLDivElement> {
  /** One removable <EntityChip>: size medium on desktop, large on mobile (Figma `device`). Figma: `active filter`. */
  children?: ReactNode;
  /** Accessible name of the group. @default "Active filter" */
  "aria-label"?: string;
}
export declare function ActiveFilter(props: ActiveFilterProps): JSX.Element;

/** Mirrors the Figma component `tag item`: a static label chip on surface-support-1. */
export interface TagProps extends HTMLAttributes<HTMLElement> {
  /** Renders the tag as a link (<a>). Same look; hover/focus states are not designed yet. */
  href?: string;
  /** Figma: `size`. extra-small = 18px, small = 22px, medium = 24px, large = 28px. @default "small" */
  size?: "extra-small" | "small" | "medium" | "large";
  /** Label text. Figma: `Label`. */
  children: ReactNode;
}
export declare function Tag(props: TagProps): JSX.Element;

/** Mirrors the Figma component `tag group`: a wrapping list of <Tag>s, gap 4. Figma's `orientation` axis is not ported (both variants are horizontal). */
export interface TagGroupProps extends HTMLAttributes<HTMLUListElement> {
  /** <Tag> elements; wraps, gap 4. Figma: slot `tags`. */
  children: ReactNode;
}
export declare function TagGroup(props: TagGroupProps): JSX.Element;

/** Mirrors the Figma component `player button` (state default | hover | pressed | disabled) with the nested
 *  `_player button-icon` (state default | playing) exposed as `playing`. No chrome: icon + label in action-floating-*. */
export interface PlayerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Nested `_player button-icon` state=playing: pause icon instead of play. Also sets aria-pressed. */
  playing?: boolean;
  /** Native disabled; also drives the Figma state=disabled colour. */
  disabled?: boolean;
  /** Label (body-medium): the sample / track name. */
  children: ReactNode;
  /** Documentation only: pins an interaction state regardless of pointer. Do not use in product code. */
  state?: "default" | "hover" | "pressed" | "disabled";
}
export declare function PlayerButton(props: PlayerButtonProps): JSX.Element;

/** Mirrors the Figma component `icon button` (state default | hover | pressed | disabled): 24 × 24, icon only. */
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The 24px icon (an <svg> using currentColor). Defaults to PlayIcon, the icon drawn in Figma. */
  icon?: ReactNode;
  /** Required: the button has no visible label. */
  "aria-label": string;
  /** Native disabled; also drives the Figma state=disabled colour. */
  disabled?: boolean;
  /** Documentation only: pins an interaction state regardless of pointer. Do not use in product code. */
  state?: "default" | "hover" | "pressed" | "disabled";
}
export declare function IconButton(props: IconButtonProps): JSX.Element;

/** Mirrors the Figma component `player` (device=desktop | mobile) with the building block `_player controls`.
 *  Presentational: the site owns playback, the queue, docking and the slide in/out. */
export interface PlayerProps extends HTMLAttributes<HTMLElement> {
  /** Omitted → responsive (breakpoint `--mobile` from tokens.json). */
  device?: "desktop" | "mobile";
  /** Cover of the product, 48 × 48. Figma: `product image`. `srcSet`: optional smaller files (decision 0108); `sizes` defaults to 48px. */
  image?: { src: string; alt?: string; srcSet?: string; sizes?: string };
  /** The sample title, e.g. "Vocal". Figma: first `product name` text. */
  sampleTitle: ReactNode;
  /** "Artist - Title". Figma: second `product name` text. */
  productName: ReactNode;
  /** 1-based position of the sample in the queue. Shown as the sample number (Figma: `sample number`) and in "1 of 3". Previous is disabled at 1. @default 1 */
  index?: number;
  /** Queue length. Next is disabled at the last sample. @default 1 */
  total?: number;
  /** Nested `_player controls` state=playing: pause icon instead of play. */
  playing?: boolean;
  /** Audio URL for the native player (a direct file: mp3, aac, ogg). */
  src?: string;
  /** Small secondary Buttons, e.g. "Add to bag" and "View" (href). Figma: gap 4. */
  actions?: ReactNode;
  /** Previous sample. */
  onPrevious?: () => void;
  /** Next sample. */
  onNext?: () => void;
  /** Play / pause. */
  onTogglePlay?: () => void;
  /** Close button (top right): the site stops playback and hides the player. */
  onClose?: () => void;
  /** Ref to the native audio element. */
  audioRef?: Ref<HTMLAudioElement>;
}
export declare function Player(props: PlayerProps): JSX.Element;

/** Mirrors the Figma component `product info` (device=desktop | mobile): the text block of a PDP. */
export interface ProductInfoProps extends HTMLAttributes<HTMLElement> {
  /** Omitted → responsive (breakpoint `--mobile` from tokens.json, <768px placeholder). */
  device?: "desktop" | "mobile";
  /** Figma `product name` — rendered as a heading, <h1> by default. */
  title: ReactNode;
  /** Heading level of the title. The PDP keeps 1; inside another page (the admin preview) pass a lower level. @default 1 */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Figma `price`, already formatted. */
  price?: ReactNode;
  /** Figma `release info`, e.g. "Label Format (Country)". */
  releaseInfo?: ReactNode;
  /** A <TagGroup>. */
  tags?: ReactNode;
  /** Figma `Description`. */
  description?: ReactNode;
  /** Figma `grading`: the record's grade, already formatted ("Record: VG+ / VG"). */
  grading?: ReactNode;
  /** Figma `cover` (boolean + text): the cover/sleeve grade below the record's, already formatted ("Cover: NM"). Omit when not graded. */
  cover?: ReactNode;
  /** Figma `conditions` (boolean + text): the conditions comment on its own line below the cover grade, already formatted ("(Light marks)").
   *  Same type and gap as the grade lines. Omit when there is no comment, or when it already follows the record grade (no cover line). */
  conditions?: ReactNode;
  /** <PlayerButton>s. Desktop: columns 2–3, stacked; mobile: full width, in a row. */
  samples?: ReactNode;
}
export declare function ProductInfo(props: ProductInfoProps): JSX.Element;

/** Mirrors the Figma component `product card` (device=desktop | mobile): a release in a list. One markup; CSS grid places
 *  the blocks per variant (the description moves from the purchase column on desktop to the info column on mobile). */
export interface ProductCardImage {
  /** Cover URL. Omitted → the empty square (surface/media). */
  src?: string;
  /** Alt text; empty = decorative (the title already names the release). */
  alt?: string;
  /** Optional `srcset`: the same photo in smaller files, the browser picks one (decision 0108). */
  srcSet?: string;
  /** Optional `sizes`: how wide the image is drawn. Fixed-size images (BagItem, OrderRow 96px) default to their size; a ProductCard's depends on the page grid, so the page passes it. */
  sizes?: string;
}
export interface ProductCardProps extends HTMLAttributes<HTMLElement> {
  /** Omitted → responsive (breakpoint `--mobile` from tokens.json, <768px placeholder). */
  device?: "desktop" | "mobile";
  /** Figma `state`. Pins the hover look in docs/previews only; on the site `:hover` drives it (decisions 0009, 0088). @default "default" */
  state?: "default" | "hover";
  /** Figma `product image`: the cover, square. */
  image?: ProductCardImage;
  /** Product page URL: the cover becomes a link to it (no visual change; a designed link style is in open.md). */
  href?: string;
  /** Figma `product name`. Rendered as a heading; it also names the card and its button. */
  title: ReactNode;
  /** Heading level of the title, to fit the page outline. @default 2 */
  headingLevel?: 2 | 3 | 4;
  /** Figma `release info`, e.g. "Label Format (Country)". */
  releaseInfo?: ReactNode;
  /** Figma `price`, already formatted. */
  price?: ReactNode;
  /** Figma `description`. Desktop: purchase column, below the price; mobile: info column, below the title. */
  description?: ReactNode;
  /** Figma `grading`: the record's grade, already formatted ("Record: VG+ / VG"). */
  grading?: ReactNode;
  /** Figma `cover` (boolean + text): the cover/sleeve grade below the record's, already formatted ("Cover: NM"). Omit when not graded. */
  cover?: ReactNode;
  /** Figma `conditions` (boolean + text): the conditions comment on its own line below the cover grade, already formatted ("(Light marks)").
   *  Same type and gap as the grade lines. Omit when there is no comment, or when it already follows the record grade (no cover line). */
  conditions?: ReactNode;
  /** Tag labels, or `{ label, href }` for a tag that links somewhere. Rendered as a TagGroup: size large on desktop, small on mobile. */
  tags?: Array<string | { label: string; href?: string }>;
  /** <PlayerButton>s, in a row (gap 8). */
  samples?: ReactNode;
  /** Click on the add button. */
  onAdd?: () => void;
  /** Makes the add button a link (trade listings: the offer page, label "Make an offer" / "Offer"). */
  addHref?: string;
  /** Desktop button label (Figma: "Add to bag"). Default "Add to bag". */
  addLabel?: string;
  /** Mobile button label (Figma: "Add"). Default "Add". */
  addLabelShort?: string;
  /** Figma `button`. false: no add button (a sale copy without a price, decision 0207). @default true */
  button?: boolean;
}
export declare function ProductCard(props: ProductCardProps): JSX.Element;

/** One line of the bag = one copy (Figma: page Bag → `bag item`, device × status). Copies are unique: no quantity, Remove only (decision 0044). */
export interface BagItemProps extends HTMLAttributes<HTMLElement> {
  /** Omitted → responsive (breakpoint `--mobile` from tokens.json): desktop type = ProductCard desktop, mobile = ProductCard mobile. */
  device?: "desktop" | "mobile";
  /** Figma `status`. sold: name plain, "SOLD OUT" in an inline Alert (alert box, decision 0078) beside the struck price, no notice (decision 0064). reserved (held by someone else's checkout or by hand): the same, with "RESERVED" (decision 0065). offer: a copy bought at an accepted Best offer, priced as available, with `offerNote`; offer-expired: as sold with "EXPIRED" (decision 0186). Samples stay. `unavailable` is the pre-0064 name of reserved. @default "available" */
  status?: "available" | "sold" | "reserved" | "unavailable" | "offer" | "offer-expired";
  /** The word beside the struck price of a sold / reserved / offer-expired line. @default "SOLD OUT" / "RESERVED" / "EXPIRED" */
  notice?: ReactNode;
  /** Figma `offer note` (status offer | offer expired, decision 0186): one line above the name, body/small text/moderate,
   *  e.g. "Your offer · held until Wed 25 Nov, 16:30" / "Your offer expired on Wed 25 Nov, 16:30". */
  offerNote?: ReactNode;
  /** Figma `cover`: the cover image, 96 × 96. */
  image?: ProductCardImage;
  /** Product page URL: the title and the cover link to it. */
  href?: string;
  /** Figma `product name`. Rendered as a heading; it also names the line and its Remove button. */
  title: ReactNode;
  /** Heading level of the title, to fit the page outline. @default 2 */
  headingLevel?: 2 | 3 | 4;
  /** Figma `release info`. */
  releaseInfo?: ReactNode;
  /** Figma `price`, already formatted. status=sold: struck through, after "SOLD OUT". Not rendered when status=reserved. */
  price?: ReactNode;
  /** Figma `grading`, already formatted ("Record: VG+ / VG"). */
  grading?: ReactNode;
  /** Figma `cover` grade line ("Cover: NM"). Omit when not graded. */
  cover?: ReactNode;
  /** The conditions comment on its own line, as in ProductCard. */
  conditions?: ReactNode;
  /** <PlayerButton>s, in a row (gap 8), as in ProductCard. */
  samples?: ReactNode;
  /** Click on Remove. */
  onRemove?: () => void;
  /** Remove button label. @default "Remove" */
  removeLabel?: string;
}
export declare function BagItem(props: BagItemProps): JSX.Element;

/** One record of a past order (Figma: page Account → `order item`, decision 0101): the BagItem anatomy without Remove; the price is what was paid. Same type styles as BagItem. */
export interface OrderItemProps extends Omit<BagItemProps, "status" | "notice" | "onRemove" | "removeLabel"> {}
export declare function OrderItem(props: OrderItemProps): JSX.Element;

/** One order in the account's order list (Figma: page Account → `order row`, decision 0101). The whole row is one link; "View" is drawn as a secondary small Button but is not a second tab stop. */
export interface OrderRowProps extends HTMLAttributes<HTMLAnchorElement> {
  /** Omitted → responsive (breakpoint `--mobile`): type as BagItem desktop / mobile. */
  device?: "desktop" | "mobile";
  /** The order page URL. */
  href: string;
  /** The link's accessible name, the whole row in one sentence: "Order 1A2B3C4D, 9 Nov 2026, shipped, 39€". */
  label: string;
  /** Figma `first cover`: the cover of the first record, 96 × 96 (decorative: alt is always empty). */
  image?: ProductCardImage;
  /** Figma heading line 1, "Order 1A2B3C4D". */
  title: ReactNode;
  /** Figma heading line 2, the date ("12 Nov 2026"). */
  date?: ReactNode;
  /** Figma details line 1, "3 records". */
  count?: ReactNode;
  /** Figma details line 2, "Status: Shipped". */
  status?: ReactNode;
  /** Figma `total`, already formatted ("33€"). */
  total: ReactNode;
  /** @default "View" */
  viewLabel?: ReactNode;
}
export declare function OrderRow(props: OrderRowProps): JSX.Element;

/** The bag's totals and the way to checkout (Figma: page Bag → `bag summary`). Shipping and tax are computed by Stripe Checkout: the bag shows the subtotal only (decision 0044). */
export interface BagSummaryProps extends HTMLAttributes<HTMLElement> {
  /** Figma `subtotal label`, e.g. "Subtotal (3 records)". @default "Subtotal" */
  subtotalLabel?: ReactNode;
  /** Figma `subtotal`, already formatted ("33€"). */
  subtotal?: ReactNode;
  /** @default "Shipping" */
  shippingLabel?: ReactNode;
  /** Default "Calculated at checkout". The estimate ("5€") or "Not available" (Figma destination=not served). */
  shipping?: ReactNode;
  /** Figma `ship to`: the country select (Input variant select, label "Ship to") above the rows. */
  shipTo?: ReactNode;
  /** @default "Total" */
  totalLabel?: ReactNode;
  /** Figma `total`, subtotal + shipping ("38€"). Omitted → no total row (destination=not served, or shipping not set up). */
  total?: ReactNode;
  /** Checkout button label (primary, large, fill). @default "Checkout" */
  checkoutLabel?: string;
  /** Click on Checkout. */
  onCheckout?: () => void;
  /** Disables Checkout (e.g. nothing available to buy). */
  checkoutDisabled?: boolean;
  /** Extra attributes for the Checkout button (data-*, aria-*). */
  checkoutProps?: Record<string, unknown>;
  /** Figma `note`, body/small, below the button. */
  note?: ReactNode;
  /** Figma `sold out` + `sold out note`, an `Alert` (alert box, decision 0077) above Checkout: says that sold lines are not in the order ("1 record sold out, not included.", decision 0064). Omit when the bag has no sold lines. */
  soldOutNote?: ReactNode;
  /** Extra attributes for the sold out note (data-*, hidden), so a script can fill it; rendered even without `soldOutNote`. */
  soldOutNoteProps?: Record<string, unknown>;
  /** Figma `minimum note` (variant minimum=below), an `Alert` (alert box, decision 0077) above Checkout: the minimum order and what is missing ("Minimum order 20€. Add 8€ more to check out.", decision 0072). Pass it with `checkoutDisabled` and point Checkout's aria-describedby (via `checkoutProps`) at the note, so the disabled button is never unexplained. */
  minimumNote?: ReactNode;
  /** Extra attributes for the minimum note (id, data-*, hidden), so a script can fill it; rendered even without `minimumNote`. */
  minimumNoteProps?: Record<string, unknown>;
}
export declare function BagSummary(props: BagSummaryProps): JSX.Element;

/** Titled list of product cards below the product (Figma: PDP `you may also like`). Same layout on desktop and mobile: the cards carry the device. */
export interface RelatedProductsProps extends HTMLAttributes<HTMLElement> {
  /** Figma `title` (PDP: "More for sale:"). Rendered as a heading; it also names the section. */
  title: ReactNode;
  /** Heading level of the title; give the cards' titles the next level. @default 2 */
  headingLevel?: 2 | 3 | 4;
  /** Figma slot `products list`: <ProductCard>s, stacked (gap 8). */
  children?: ReactNode;
  /** Figma `view all` (boolean): one action at the end of the list, full width, inside the container (PDP: a secondary large Button linking to the section, "View all for sale"). */
  action?: ReactNode;
}
export declare function RelatedProducts(props: RelatedProductsProps): JSX.Element;

/** "Back to this record" card (Figma: PDP `product return card`). Desktop PDP: docked on the anchored gallery once "More for sale" covers the record; the page decides when it shows and what pressing it does (decision 0119). Renders a <button>. */
export interface ProductReturnCardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Figma `cover`: 48 × 48, cropped to fill. Usually decorative (alt ""): the name is in the text. */
  image?: { src: string; alt?: string };
  /** Figma `name` (body/small, max 2 lines, then …). */
  name: ReactNode;
  /** Figma `price` (body/small): the price, or "Trade only". */
  price?: ReactNode;
  /** Give the button a name that says where it goes, e.g. "Back to <record>". */
  'aria-label'?: string;
  /** Documentation only: pins the Figma state. Do not use in product code. */
  state?: 'default' | 'hover';
}
export declare function ProductReturnCard(props: ProductReturnCardProps): JSX.Element;

/** Product images: 2 per product. Desktop: stacked full width, gap gutter-small, vertical scroll inside `--hm-gallery-max-height` (set by the page); mobile: horizontal swipe. Mirrors the PDP frames (no Figma gallery component yet). */
export interface GalleryImage {
  /** Image URL. */
  src: string;
  /** Alt text; empty = decorative. */
  alt?: string;
  /** Optional `srcset` (decision 0108). */
  srcSet?: string;
  /** Optional `sizes`: the gallery width depends on the page, so the page passes it. */
  sizes?: string;
}
export interface GalleryProps extends HTMLAttributes<HTMLDivElement> {
  /** Omitted → responsive (breakpoint `--mobile` from tokens.json, <768px placeholder). */
  device?: "desktop" | "mobile";
  /** In order; the first is the main image. */
  images: GalleryImage[];
}
export declare function Gallery(props: GalleryProps): JSX.Element;

/** Mirrors the Figma component `input` (type text field | search | select) over the building block `_input-master`
 *  (size × state default | filled | error | locked). Admin forms; render inside data-theme="backend".
 *  Props not listed here go to the native <input> / <select> (name, value, onChange, required, disabled…). */
export interface InputProps {
  /** Figma `type` (renamed: `type` is the native input attribute). search adds the magnifying glass, select the chevron. @default "text-field" */
  variant?: "text-field" | "search" | "select" | "text-area";
  /** Figma `size`. medium = 38px field, compact = 30px. @default "medium" */
  size?: "medium" | "compact";
  /** Figma `label`. Rendered as a <label> (body-small). Without it, pass `aria-label`. */
  label?: ReactNode;
  /** Figma `optional`: shows "Optional" right-aligned in the label row (part of the accessible name). */
  optional?: boolean;
  /** Text of the optional marker. Default "Optional". */
  optionalLabel?: string;
  /** Figma `support text` (emphasis neutral). Linked with aria-describedby. */
  supportText?: ReactNode;
  /** Figma state=error: alert border + this message in place of the support text (emphasis alert); sets aria-invalid. */
  error?: ReactNode;
  /** Figma `prefix`, e.g. "€". Visual only: say it in the label too. */
  prefix?: ReactNode;
  /** Figma `suffix`. Visual only. */
  suffix?: ReactNode;
  /** Figma `leading icon` (20px). Default none (search: the magnifier is trailing since 2026-11-12). */
  /** search only: accessible name of the trailing magnifier, which becomes the form's submit button (Figma type=search). Omit → decorative icon. */
  submitLabel?: string;
  /** search only: accessible name of the × in the leading slot (Figma type=search, state=filled), shown while the field has text. Needs a placeholder. */
  clearLabel?: string;
  /** search only: click on the × (empty the field and keep focus in it). */
  onClear?: () => void;
  leadingIcon?: ReactNode;
  /** Figma `trailing icon` (20px). Default: ChevronDownIcon for select, none otherwise. */
  trailingIcon?: ReactNode;
  /** Figma state=locked: read-only, surface-subtle, no border (e.g. the automatic SKU). A locked select is disabled. */
  readOnly?: boolean;
  /** Placeholder text. For select: the empty first option (Figma "Select"). */
  placeholder?: string;
  /** For select: the <option>s. */
  children?: ReactNode;
  /** id of the native control; generated when omitted. */
  id?: string;
  /** On the wrapper. */
  className?: string;
}
export declare function Input(props: InputProps & Record<string, unknown>): JSX.Element;

/** Mirrors the Figma component `drop zone` (page `uploads`): upload area under each file list, a dashed box with a
 *  secondary Button that opens the file picker; files can also be dropped on it. */
export interface DropZoneProps extends Omit<HTMLAttributes<HTMLDivElement>, "onDrop"> {
  /** Button label, e.g. "Browse image". */
  label: ReactNode;
  /** Native accept, e.g. "image/*" or "audio/mpeg". */
  accept?: string;
  /** Allow several files. */
  multiple?: boolean;
  /** Called with the picked or dropped files. Filter by type in the handler: `accept` does not apply to drops. */
  onFiles?: (files: File[]) => void;
  /** Disables the button and ignores drops. */
  disabled?: boolean;
  /** Name of the hidden file input. */
  name?: string;
  /** Shows a second button "Take photo" (Figma boolean `take photo`, on only in the Images zone, decision 0200). */
  onTakePhoto?: () => void;
  /** @default "Take photo" */
  takePhotoLabel?: ReactNode;
}
export declare function DropZone(props: DropZoneProps): JSX.Element;

/** Ordered list of uploaded files (Figma: a layout frame `file list` of `file item` instances). Numbers its FileItems 01, 02… and handles reordering. */
export interface FileListProps extends HTMLAttributes<HTMLOListElement> {
  /** Called on drop after dragging a row (the other rows shift live to preview the new order), or when a row is moved with ↑ ↓ on its handle. Omit for a fixed order (no handles). */
  onMove?: (from: number, to: number) => void;
  /** <FileItem>s, each with a stable key. */
  children?: ReactNode;
}
export declare function FileList(props: FileListProps): JSX.Element;

/** Mirrors the Figma component `file item` (page `uploads`): [drag handle] · [thumbnail | play] position name (featured) · [remove].
 *  Figma `type` = `image` given or `onTogglePlay` given · `state=dragging` = set by FileList while the row is dragged · `handle` = FileList `onMove` · `title field` = children. */
export interface FileItemProps extends HTMLAttributes<HTMLDivElement> {
  /** File name, e.g. "sample-name.mp3". Also names the buttons for screen readers. */
  name: string;
  /** Shown before the name. Default: the row number inside FileList, two digits ("01"). */
  position?: ReactNode;
  /** Image file: the 40 × 40 thumbnail (empty = surface-media). */
  image?: { src?: string; alt?: string };
  /** Shows "(featured)". The admin sets it on the first image (the featured image is always position 1). */
  featured?: boolean;
  /** Text of the featured marker. Default "(featured)". */
  featuredLabel?: string;
  /** Audio file: pause icon instead of play. */
  playing?: boolean;
  /** Audio file: shows the play / pause IconButton. */
  onTogglePlay?: () => void;
  /** Shows the remove (×) IconButton. */
  onRemove?: () => void;
  /** Accessible name of the remove button. Default "Remove <name>". */
  removeLabel?: string;
  /** Accessible name of the drag handle. Default "Move <name>, position n of m (arrow up / down)". */
  reorderLabel?: string;
  /** Content under the file row, e.g. the sample title Input (Figma `sample row` 2095:20507). With children the item is
   *  full width: [handle] · column of `file row` (file + remove, gap 16) and the children (gap 16). */
  children?: ReactNode;
}
export declare function FileItem(props: FileItemProps): JSX.Element;

/** Mirrors the Figma component `alert` (page `Bag`, decision 0077): a message that blocks an action, in an alert box (surface-alert)
 *  (surface-alert, text-on-alert, body/small, padding small), full width. Renders <p>; add aria-live / id as needed. */
export interface AlertProps extends HTMLAttributes<HTMLElement> {
  /** Figma `layout`. block: a <p>, padding small, fills its container. inline: a <span>, padding 2/4, hugs (bag item SOLD OUT / RESERVED, decision 0078). @default "block" */
  layout?: "block" | "inline";
  /** The message: what blocks the action and what to do, e.g. "Minimum order 20€. Add 8€ more to check out." */
  children?: ReactNode;
}
export declare function Alert(props: AlertProps): JSX.Element;

/** Mirrors the Figma component `divider` (page `divider`): a 1px rule in border/divider/strong, full width. Renders <hr>. */
export interface DividerProps extends HTMLAttributes<HTMLHRElement> {}
export declare function Divider(props: DividerProps): JSX.Element;

/** Mirrors the Figma component `action panel` (page `listing form`): surface/subtle, padding 16, a column of Buttons that fill it, gap 8. */
export interface ActionPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** The Buttons, primary first (Figma: `primary`, `secondary`, `tertiary`; `tertiary` boolean = pass two or three). */
  children?: ReactNode;
}
export declare function ActionPanel(props: ActionPanelProps): JSX.Element;

/** Mirrors the Figma component `listing status` (page `listing form`, decision 0118): the state of a listing at a glance,
 *  at the top of the Create/Edit side column. A live region (role="status"). */
export interface ListingStatusProps extends HTMLAttributes<HTMLDivElement> {
  /** Figma `status`: Not saved yet | Draft | Published | Reserved | Sold | Traded | Archived. */
  status: ReactNode;
  /** Figma `details`: when (published / saved / since) and the SKU. */
  details?: ReactNode;
  /** Figma boolean `unsaved` (an `alert`, block): true = "Unsaved changes", or a text of its own. */
  unsaved?: boolean | ReactNode;
  /** Figma boolean `shop update`: true = "The shop updates in about 2 minutes.", or a text of its own. */
  shopUpdate?: boolean | ReactNode;
}
export declare function ListingStatus(props: ListingStatusProps): JSX.Element;

/** Mirrors the Figma component `listing line` (page `listing form`): one track line of a listing and its sample.
 *  The fields are slots placed on an 8-column grid; the page owns their state. */
export interface ListingLineProps extends HTMLAttributes<HTMLDivElement> {
  /** Artist field (EntityField). Columns 1–4, or 1–3 when removable. */
  artist: ReactNode;
  /** Title field (Input). Columns 5–8, or 4–7 when removable. */
  title: ReactNode;
  /** The "Different spelling" Checkbox, row 2 under the artist. */
  spelling?: ReactNode;
  /** "Artist name on label" Input, row 2 under the title. Figma: `artist on label` boolean. Pass it only when `spelling` is checked. */
  credit?: ReactNode;
  /** Figma `removable=true` (line 2+): shows the remove × in column 8 and narrows the artist to 3 columns. Omit for line 1. */
  onRemove?: () => void;
  /** Accessible name of the remove button, e.g. "Remove line 2". Default "Remove line". */
  removeLabel?: string;
  /** The sample, below the fields (gap 8). Figma `sample`: uploaded = a FileList with one FileItem, empty = a DropZone (decision 0022). */
  children?: ReactNode;
  /** Figma boolean `number` + `marker` text: the line number in a Marker before the fields (gap 0). Omit → no marker. */
  marker?: ReactNode;
}
export declare function ListingLine(props: ListingLineProps): JSX.Element;

/** Mirrors the Figma component `checkbox` (page `controls`, state default | active). A native checkbox (decision 0018):
 *  every prop that is not listed here goes to the <input>; the whole row is the clickable <label>. */
export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Text next to the box. Figma: the text layer (e.g. "Different spelling"). */
  label?: ReactNode;
  /** Native checked (controlled, with onChange). Figma: state=active. */
  checked?: boolean;
  /** Some, not all, of a group are checked (select-all of a table). Sets the native property, announced as "mixed". Figma: state=indeterminate. */
  indeterminate?: boolean;
  /** Hide the label visually; it stays the accessible name (e.g. "Select <record>" on a table row). Figma: `label` = false. */
  hideLabel?: boolean;
  /** Documentation only: pins the Figma state when `checked` is not given. Do not use in product code. */
  state?: "default" | "active" | "indeterminate";
}
export declare function Checkbox(props: CheckboxProps): JSX.Element;

/** Mirrors the Figma component `dialog` (page dialog). A modal confirmation on the native <dialog> (showModal):
 *  focus trapped, Esc = cancel, focus back to the opener. Admin: before every bulk action (decision 0025). */
export interface DialogProps extends Omit<HTMLAttributes<HTMLDialogElement>, "title"> {
  /** Shown as a modal while true. Controlled. */
  open: boolean;
  /** The question, with the count ("Delete 2 listings?"). Figma: `title`. */
  title: ReactNode;
  /** The consequence: what goes, what is skipped. Figma: `body`. */
  children: ReactNode;
  /** The confirm button: verb + count ("Delete 2 listings"). Primary. */
  confirmLabel: ReactNode;
  /** Secondary button; gets the initial focus. Default "Cancel". */
  cancelLabel?: ReactNode;
  onConfirm: () => void;
  /** Cancel button and Esc. */
  onCancel: () => void;
  /** The confirmed action is running: the confirm button ignores clicks and is aria-busy. */
  busy?: boolean;
  /** A required pick under the body, e.g. which artist to keep when merging: pass a <RadioGroup>. Figma: `choices`. */
  choices?: ReactNode;
  /** One form field under the body (Figma: boolean `field`, a text area by default; decision 0187), e.g. the optional
   *  message of admin → Offers → Decline, or the email of "Notify me": pass an <Input>. */
  field?: ReactNode;
}
export declare function Dialog(props: DialogProps): JSX.Element;

/** Figma: page `toast` → `toast` (2177:439). Decision 0049: confirms a done action whose result left the view, or
 *  brings off-screen news; never an error. One look, no types. Shown through ToastRegion + packages/ui/toast.js. */
export interface ToastProps extends HTMLAttributes<HTMLDivElement> {
  /** What happened, past tense, two lines at most ("Removed from bag."). Figma: `message`. */
  message: ReactNode;
  /** One verb ("Undo", "View bag"): a secondary small Button. Omit for no action. Figma: `action`. With Undo it never times out; with an action also on the page (View bag) it closes after 6 s (0050). */
  actionLabel?: ReactNode;
  onAction?: () => void;
  /** The × IconButton. Figma: `dismiss`. Default true. */
  dismiss?: boolean;
  onDismiss?: () => void;
  /** Accessible name of the ×. Default "Dismiss". */
  dismissLabel?: string;
}
export declare function Toast(props: ToastProps): JSX.Element;

/** The one place toasts appear: fixed at the top of the viewport, gutter-small below `--hm-toast-offset` (the shop:
 *  its visible header, 0071); a visually hidden live region (role=status, polite) present at load, an empty slot and a template of the Toast. Render it once per page, outside the swapped
 *  page content; the behaviour is `HighmuzikToast.show()` in packages/ui/toast.js. */
export interface ToastRegionProps extends HTMLAttributes<HTMLElement> {
  /** Landmark name. Default "Notifications". */
  "aria-label"?: string;
}
export declare function ToastRegion(props: ToastRegionProps): JSX.Element;

/** One entity in an EntityField: an existing one (`id`) or a new one to create on save (`id` null). */
export interface EntityValue {
  id: string | null;
  name: string;
  [key: string]: unknown;
}
/** A suggestion source: official name + other spellings (shown as "alias → name"). */
export interface EntityOption {
  id: string;
  name: string;
  aliases?: string[];
}
/** Mirrors the Figma `input` with `chips` on (decision 0020): chips of the chosen entities + a text box with a
 *  suggestion menu (`entity option`). WAI-ARIA combobox; keyboard: arrows, Enter, Escape, Backspace removes the last chip. */
export interface EntityFieldProps {
  /** Id of the text box (the label points to it). */
  id?: string;
  /** Figma: label text. */
  label?: ReactNode;
  /** Figma: optional. Shows "Optional" next to the label. */
  optional?: boolean;
  optionalLabel?: ReactNode;
  /** Figma: support text. */
  supportText?: ReactNode;
  /** Figma: state=error; replaces the support text. */
  error?: ReactNode;
  /** Placeholder of the text box. */
  placeholder?: string;
  /** The chosen entities (controlled). */
  value: EntityValue[];
  /** Suggestions. Matches: names that start with the text, then that contain it, then aliases; first 8. */
  options?: EntityOption[];
  /** Called with the new list; `info.alias` is set when an alias was picked (the chip is the official name). */
  onChange?: (value: EntityValue[], info: { added?: EntityValue; removed?: EntityValue; alias?: string | null }) => void;
  /** false = one chip; the text box is hidden while it is set (Label). */
  multiple?: boolean;
  /** false hides "Create “…”". */
  allowCreate?: boolean;
  /** Verb of the create row. */
  createLabel?: string;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}
export declare function EntityField(props: EntityFieldProps): JSX.Element;

/** A custom title link: characters [start, end) of the text link to an artist (decision 0147). */
export interface TextLink { start: number; end: number; artist: { id: string | null; name: string } }
/** Figma BACKEND → Create → `custom title`, `title link bar`, `title link menu` (decision 0147): a text field whose
 *  characters link to an artist. Select characters or click a name of the record / a link: a bar under the field offers
 *  Link artist (or ⌘K / Ctrl+K) and Clear link / Remove link; it never takes the focus, so Delete and typing work as usual.
 *  Clear unlinks exactly the selected characters. Typing moves the links with the text. Other props go to the Input. */
export interface LinkedInputProps {
  id?: string;
  /** Figma: label text. */
  label?: ReactNode;
  optional?: boolean;
  error?: ReactNode;
  /** The text (controlled). */
  value: string;
  /** The links, as character ranges of `value` (controlled). */
  links: TextLink[];
  /** Called with the new text and links (typing moves the links; Link / Clear change them). */
  onChange?: (value: string, links: TextLink[]) => void;
  /** Every artist the menu can search. */
  options?: EntityOption[];
  /** The record's artists: listed first in the menu (the one matching the selection as "Suggested"). */
  suggested?: { id: string | null; name: string }[];
  /** Names on the record: a click on one of them (not linked yet) offers Link artist for the whole name. */
  names?: string[];
  /** @default "Link artist" */
  linkLabel?: string;
  /** @default "Search artist" */
  menuPlaceholder?: string;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}
export declare function LinkedInput(props: LinkedInputProps): JSX.Element;

/** Figma `entity chip` (page tags; state default | hover | focus × size medium | large): `tag item` + a remove button. */
export interface EntityChipProps extends HTMLAttributes<HTMLSpanElement> {
  label?: ReactNode;
  /** medium = 24px, body/small, 24×24 remove; large = 44px, body/medium, 44×44 remove with a 24px icon (mobile filters). Figma: `size`. @default "medium" */
  size?: "medium" | "large";
  /** Remove button handler; its accessible name is `removeLabel` or "Remove <label>". */
  onRemove?: () => void;
  /** Makes the remove control a link to this URL instead of a button (removing leaves the page, e.g. the collection chip, decision 0178). */
  removeHref?: string;
  removeLabel?: string;
  /** Documentation only: pins the Figma state. Do not use in product code. */
  state?: "default" | "hover" | "focus";
}
export declare function EntityChip(props: EntityChipProps): JSX.Element;
export declare function XThinIcon(): JSX.Element;
export declare function PlusSmallThinIcon(): JSX.Element;
/** Figma icon/icon-tick-large-thin. Trailing icon of "Added to bag" (decision 0046). */
export declare function TickLargeThinIcon(): JSX.Element;
/** Figma: icon/icon-clock-counter-clockwise. Leading icon of the "Reserved" Add button (copy held by a checkout). */
export declare function ClockCounterClockwiseIcon(): JSX.Element;
/** Figma: icon/icon-envelope. Trailing icon of the "(Reserved) Notify me" Add button (decision 0065). */
export declare function EnvelopeIcon(): JSX.Element;

/** Mirrors the Figma component `radio` (page controls): a native radio, 24px control (18px icon), gap 8, label body/medium. */
export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Text next to the control. Figma: the text layer. */
  label?: ReactNode;
  /** The value this radio stands for inside its RadioGroup. */
  value: string;
  /** Hide the label visually; it stays the accessible name. Figma: `label` = false. */
  hideLabel?: boolean;
  /** Documentation only: pins the Figma state outside a RadioGroup. Do not use in product code. */
  state?: "default" | "active";
}
export declare function Radio(props: RadioProps): JSX.Element;

/** A group of Radios: <fieldset> + <legend>, gap 8. Exactly one value is picked; arrow keys move between radios. */
export interface RadioGroupProps extends Omit<HTMLAttributes<HTMLFieldSetElement>, "onChange"> {
  /** Shared input name. Default: a generated id. */
  name?: string;
  /** The picked value (controlled). */
  value?: string;
  onValueChange?: (value: string) => void;
  /** The question the group answers; required for screen readers. */
  legend?: ReactNode;
  /** Keep the legend for assistive tech only (e.g. inside a Dialog whose body already asks the question). */
  hideLegend?: boolean;
  /** <Radio> elements. */
  children: ReactNode;
}
export declare function RadioGroup(props: RadioGroupProps): JSX.Element;

/** Mirrors the Figma component `filter` (page filters): a native checkbox. Responsive (Figma `device`): desktop 16px box, gap 8, label + count body/small; mobile 24px box, label + count body/medium, padding-y 8, full width (40px row). */
export interface FilterProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Option name. Figma: `Label`. */
  label?: ReactNode;
  /** Records matching this option. Figma: `count` + `count text`. Omit to hide. */
  count?: ReactNode;
  /** label = plain text (shop PLP), tag = a medium Tag. Figma: `content`. @default "label" */
  content?: "label" | "tag";
  /** Documentation only: pins the Figma state when `checked` is not given. Do not use in product code. */
  state?: "default" | "active";
}
export declare function Filter(props: FilterProps): JSX.Element;

/** Mirrors the Figma component `filter block`: <fieldset> with the heading as <legend> (label/extra small), gap 16, options gap 8. */
export interface FilterBlockProps extends HTMLAttributes<HTMLFieldSetElement> {
  /** The facet ("Genre", "Format"). Figma: `Label`. */
  label: ReactNode;
  /** Keep the heading for assistive tech only. Figma: `label` = false. */
  hideLabel?: boolean;
  /** <Filter> elements. Figma: slot. */
  children: ReactNode;
}
export declare function FilterBlock(props: FilterBlockProps): JSX.Element;

/** Mirrors the Figma component `filters`: the PLP filter column, one FilterBlock per facet, gap 24, padding 0 8. */
export interface FiltersProps extends HTMLAttributes<HTMLDivElement> {
  /** <FilterBlock> elements. */
  children: ReactNode;
}
export declare function Filters(props: FiltersProps): JSX.Element;

/** Mirrors the Figma component `filter facet`: a row of the mobile filters layer (level=main) that opens one facet's level. */
export interface FilterFacetProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The facet ("Genre"). label/medium, uppercase. Figma: `label`. */
  label: ReactNode;
  /** The ticked options ("Dancehall, Roots"), body/small text-moderate, one line. Omit when none. Figma: `value` + `value visible`. */
  value?: ReactNode;
}
export declare function FilterFacet(props: FilterFacetProps): JSX.Element;

/** Mirrors the Figma component `filters layer` (level main | facet): the mobile filters, full height, actions sticky at the bottom. */
export interface FiltersLayerProps extends HTMLAttributes<HTMLDivElement> {
  /** main = applied recap + FilterFacet rows; facet = the options of one facet, with Back. Figma: `level`. @default "main" */
  level?: "main" | "facet";
  /** Bar title: "Filter" on main, the facet name on facet. Figma: `facet` (level=facet). */
  title: ReactNode;
  /** Applied filters as EntityChip size=large (level=main). Figma: `applied`. */
  applied?: ReactNode;
  /** Recap heading. @default "Applied" */
  appliedLabel?: ReactNode;
  /** Records the current choice would show, Apply's suffix (0029). */
  applyCount?: ReactNode;
  /** @default "Apply" */
  applyLabel?: ReactNode;
  /** @default "Reset" */
  resetLabel?: ReactNode;
  onApply?: () => void;
  onReset?: () => void;
  onBack?: () => void;
  onClose?: () => void;
  /** Accessible names of the icon buttons. @default "Back to filters" / "Close filters" */
  backLabel?: string;
  closeLabel?: string;
  /** Level content: FilterFacet rows (main) or a FilterBlock (facet). */
  children?: ReactNode;
}
export declare function FiltersLayer(props: FiltersLayerProps): JSX.Element;

/** Mirrors the Figma component `PLP header` (device=mobile): filters trigger and sort, space-between, padding-y 8, bottom rule. */
export interface PlpHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /** The filters trigger: Button secondary small "Filter" with the applied count as `suffix`. */
  filters?: ReactNode;
  /** The sort: a SelectButton. */
  sort?: ReactNode;
}
export declare function PlpHeader(props: PlpHeaderProps): JSX.Element;

/** Mirrors the Figma component `menu item` (state default | current): a link row of the mobile menu. */
export interface MenuItemProps extends HTMLAttributes<HTMLAnchorElement | HTMLButtonElement> {
  /** The page the row leads to. Omit (and give onClick) for an action row: rendered as a <button>, e.g. the admin's Sign out (0089). */
  href?: string;
  /** Figma: `label`. Uppercase via CSS. */
  label: ReactNode;
  /** Secondary text at the end of the row (Account: "Sign in to see your orders" or the email). Figma: `detail` + `detail text`. */
  detail?: ReactNode;
  /** The page you are on: aria-current="page", fill tab-background-active. Figma: state=current. */
  current?: boolean;
}
export declare function MenuItem(props: MenuItemProps): JSX.Element;

/** A group of MenuItem rows (Figma: frames `shop`, `account`, `info` inside `menu layer`). */
export interface MenuGroupProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}
export declare function MenuGroup(props: MenuGroupProps): JSX.Element;

/** Mirrors the Figma component `menu layer`: the mobile menu, full height, put in a native modal <dialog> by the page. */
export interface MenuLayerProps extends HTMLAttributes<HTMLDivElement> {
  /** Bar title, also the name of the <nav>. @default "Menu" */
  title?: ReactNode;
  /** MenuGroup elements. */
  children?: ReactNode;
  /** Legal links (<a> elements), body-small, wrapping. Figma: `legal`. */
  legal?: ReactNode;
  /** Accessible name of the legal links group. @default "Legal" */
  legalLabel?: string;
  /** Accessible name of the close button. @default "Close menu" */
  closeLabel?: string;
  /** Click on the close button (the storefront closes the dialog in scripts/site.js instead). */
  onClose?: () => void;
}
export declare function MenuLayer(props: MenuLayerProps): JSX.Element;

/** Mirrors the Figma component `footer` (device=desktop | mobile, one responsive markup): the site footer, a <footer> landmark. */
export interface FooterProps extends HTMLAttributes<HTMLElement> {
  /** Figma boolean `newsletter`: the signup (a FooterNewsletter). Omit → the link columns take the whole row. */
  newsletter?: ReactNode;
  /** FooterLinks columns (Figma `footer link list` instances: shop, info, social). Rendered in a <nav>. */
  children?: ReactNode;
  /** Accessible name of the footer <nav>. @default "Footer" */
  navLabel?: string;
  /** Legal links (<a> elements), body-small, wrapping. Figma: `footer legal`. */
  legal?: ReactNode;
  /** Accessible name of the legal links group. @default "Legal" */
  legalLabel?: string;
  /** Figma `copyright`, e.g. "© 2026 HIGHMUZIK". */
  copyright?: ReactNode;
}
export declare function Footer(props: FooterProps): JSX.Element;

/** Mirrors the Figma component `footer link list` (group=shop | info | social): one column of links, body-small, no title. */
export interface FooterLinksProps extends HTMLAttributes<HTMLDivElement> {
  /** The links, in order. */
  links: { href: string; label: ReactNode; rel?: string; target?: string }[];
  /** Name of the list for screen readers (aria-label: the columns have no title in Figma). */
  label?: string;
}
export declare function FooterLinks(props: FooterLinksProps): JSX.Element;

/** Mirrors the Figma component `footer newsletter`: an HTML form to the provider's subscribe endpoint (works without JS). */
export interface FooterNewsletterProps extends HTMLAttributes<HTMLFormElement> {
  /** The form action: the provider's subscribe URL (Buttondown embed-subscribe). Used as is without JS, and as the fallback. */
  action: string;
  /** The site's own signup function (decision 0103): with it the page script posts there and answers in place (status line, honeypot field). */
  endpoint?: string;
  /** @default "post" */
  method?: string;
  /** Field label. @default "Newsletter" */
  label?: ReactNode;
  /** Figma `input label` off (home newsletter): no visible label; `label` (default "Email") becomes the field's aria-label. */
  hideLabel?: boolean;
  /** @default "Your email" */
  placeholder?: string;
  /** Name of the email field sent to the provider. @default "email" */
  name?: string;
  /** Button text (secondary). @default "Subscribe" */
  submitLabel?: ReactNode;
  /** Figma `note`: what you get and how double opt-in works, ending with the Privacy link (underlined). Describes the field. */
  note?: ReactNode;
}
export declare function FooterNewsletter(props: FooterNewsletterProps): JSX.Element;

/** A native <select> drawn as a Button with a trailing chevron-down (Figma: button + trailing icon). The platform picker opens. */
export interface SelectButtonProps extends HTMLAttributes<HTMLSelectElement> {
  /** The choices; the visible text is the selected option's label. */
  options: { value: string; label: string }[];
  value?: string;
  defaultValue?: string;
  /** @default "secondary" */
  hierarchy?: "primary" | "secondary";
  /** @default "small" */
  size?: "large" | "medium" | "small" | "extra-small";
  /** hug = content width; fill = full width (Figma button `layout`). @default "hug" */
  layout?: "hug" | "fill";
  /** Text before the value, same style, gap 4 ("Sort:", desktop). Figma: `prefix` + `prefix text`. */
  prefix?: ReactNode;
}
/** Focus ring: keyboard only (0081). The page sets data-focus-source="pointer" on the outer box after a pointer press (the shop does it in site.js). */
export declare function SelectButton(props: SelectButtonProps): JSX.Element;
export declare function ChevronRightIcon(): JSX.Element;
export declare function ChevronLeftIcon(): JSX.Element;

/** Figma `trade note` (page Trade, proposal 2026-11-12): Gio's first-person note on a trade record. */
export interface TradeNoteProps extends HTMLAttributes<HTMLDivElement> {
  /** Figma `title`. @default "Why it's not for sale" */
  title?: ReactNode;
  /** Heading level of the title. @default 2 */
  headingLevel?: 2 | 3 | 4;
  /** Figma `signature`, e.g. "— Gio". */
  signature?: ReactNode;
  /** Figma `body`. */
  children?: ReactNode;
}
export declare function TradeNote(props: TradeNoteProps): JSX.Element;

/** Figma `discogs card` (page Trade): identity borrowed from Discogs. */
export interface DiscogsCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Figma `label`. @default "On Discogs" */
  label?: ReactNode;
  /** Figma `handle`: the Discogs username. */
  handle: ReactNode;
  /** Figma `stats`, e.g. "Member since 2015 · 100% positive · 412 ratings". */
  stats?: ReactNode;
  /** Profile URL. Figma boolean `link`: omitted → no link. Opens in a new tab. */
  href?: string;
  /** @default "View profile" */
  linkLabel?: ReactNode;
}
export declare function DiscogsCard(props: DiscogsCardProps): JSX.Element;

/** Figma `step` (page Trade; was `trade step`, decision 0152): one numbered step (How trading works, Check your wantlist). An <li>: put it in an <ol>. */
export interface StepProps extends HTMLAttributes<HTMLLIElement> {
  number: ReactNode;
  title: ReactNode;
  children?: ReactNode;
}
export declare function Step(props: StepProps): JSX.Element;

/** Figma `release option` (page Trade): one Discogs release in the "Which record" suggestions. An <li role="option">. */
export interface ReleaseOptionProps extends HTMLAttributes<HTMLLIElement> {
  /** "Artist – Title" */
  title: ReactNode;
  /** label · catalog number · year · country · format */
  meta?: ReactNode;
  /** Discogs thumbnail URL; without it, an empty 40 px square */
  thumb?: string;
  /** the keyboard/hover active option (aria-activedescendant points to it) */
  highlighted?: boolean;
  /** Figma state=current (decision 0199): the item on screen, title underlined (JumpTo) */
  current?: boolean;
}
export declare function ReleaseOption(props: ReleaseOptionProps): JSX.Element;

/** Figma `release list` (page Trade): the suggestions box under "Which record". Children = ReleaseOption; `message` replaces them (no results). */
export interface ReleaseListProps extends HTMLAttributes<HTMLDivElement> {
  /** id of the listbox (the input's aria-controls) */
  listId?: string;
  /** accessible name of the listbox */
  label?: string;
  /** shown instead of the options, e.g. no match */
  message?: ReactNode;
  /** attribution footer, required by the Discogs API terms. Default "Data from Discogs" */
  source?: ReactNode;
  children?: ReactNode;
}
export declare function ReleaseList(props: ReleaseListProps): JSX.Element;

/** Figma `chosen release` (page Trade): the release the trader picked, with a link to Discogs and Change. */
export interface ChosenReleaseProps extends HTMLAttributes<HTMLDivElement> {
  title: ReactNode;
  meta?: ReactNode;
  thumb?: string;
  /** the release on discogs.com */
  href?: string;
  /** Default "On Discogs" */
  linkLabel?: string;
  /** Default "Change" */
  changeLabel?: string;
  onChange?: () => void;
}
export declare function ChosenRelease(props: ChosenReleaseProps): JSX.Element;

/** Figma `admin` → `listing nav` (decision 0199): the top of Edit listing. Back (Button secondary small, leading chevron-left, a link) + an optional JumpTo. */
export interface ListingNavProps extends HTMLAttributes<HTMLDivElement> {
  /** where Back goes: the Listings tab that holds the listing. `label` is the tab ("Drafts"); screen readers hear "Back to Drafts". */
  back: { href: string; label: string };
  /** a JumpTo. Figma boolean `show jump to` (on); leave it out on Create listing. */
  jumpTo?: ReactNode;
}
export declare function ListingNav(props: ListingNavProps): JSX.Element;

export interface JumpToItem {
  id: string;
  /** "Artist - Title" */
  title: string;
  /** SKU · price */
  meta?: string;
  /** 40 px thumbnail URL; without it, the empty square */
  thumb?: string;
  /** where picking it goes ("#edit-<id>") */
  href?: string;
  /** the item on screen: title underlined, highlighted when the menu opens (Figma release option state=current) */
  current?: boolean;
  /** text the search matches (accents and case ignored); default title + meta */
  search?: string;
}
/** Figma `listing nav` › jump to + `jump to menu` (content results | no results, decision 0199): a Button that opens a menu with a search (combobox) over a listbox of ReleaseOption rows. Arrows / Home / End, Enter opens, Escape closes (focus back on the button). */
export interface JumpToProps {
  id?: string;
  className?: string;
  /** button text. @default "Jump to" */
  label?: string;
  /** the dialog and listbox name, e.g. "Jump to a draft". @default label */
  menuLabel?: string;
  /** @default "Search listings" */
  placeholder?: string;
  /** null / undefined = loading */
  items?: JumpToItem[] | null;
  /** called when the menu opens (load the items then) */
  onOpen?: () => void;
  /** picking an item; default: go to item.href */
  onPick?: (item: JumpToItem) => void;
  /** @default "No listings match." */
  emptyMessage?: string;
  /** @default "Loading…" */
  loadingMessage?: string;
}
export declare function JumpTo(props: JumpToProps): JSX.Element;

/** Figma `discogs link` (BACKEND → Create, decision 0150): the Discogs release a listing is matched to, "On Discogs ↗", new tab. An <a>. */
export interface DiscogsLinkProps extends HTMLAttributes<HTMLAnchorElement> {
  /** the release on discogs.com: https://www.discogs.com/release/<id> */
  href: string;
  /** Default "On Discogs" (the ↗ is added) */
  label?: ReactNode;
}
export declare function DiscogsLink(props: DiscogsLinkProps): JSX.Element;

/** Figma `content group head` (BACKEND → Content, decision 0106): heading of a group of texts in the admin Content list. */
export interface ContentGroupHeadProps extends HTMLAttributes<HTMLDivElement> {
  heading: ReactNode;
  /** Figma boolean `has help`: one line on where the texts appear. Omit → none */
  help?: ReactNode;
  /** id of the heading, for aria-labelledby */
  headingId?: string;
  /** @default 2 */
  headingLevel?: 2 | 3;
}
export declare function ContentGroupHead(props: ContentGroupHeadProps): JSX.Element;

/** Figma `content row` (BACKEND → Content, device desktop | mobile, one responsive markup, decision 0106). An <li>: wrap in a <ul>. */
export interface ContentRowProps extends HTMLAttributes<HTMLLIElement> {
  /** what the block is (Profile, Shipping, Contact…) */
  title: ReactNode;
  /** the shop pages that show it */
  where?: ReactNode;
  /** Figma boolean `has edited`: "Edited 15 Nov 2026". Omit → none (never saved) */
  edited?: ReactNode;
  /** Figma boolean `has condition`: when the shop shows it ("Trade only: …", "Shown while “Show who I am” is on"). Omit → none */
  condition?: ReactNode;
  /** the editor (Edit is a link) */
  href: string;
  /** @default "Edit" */
  editLabel?: string;
}
export declare function ContentRow(props: ContentRowProps): JSX.Element;

/** Figma `content editor head` (BACKEND → Content, decision 0106): top of a Content editor. On mobile the actions hide:
 *  the page shows them in an ActionBar. */
export interface ContentEditorHeadProps extends HTMLAttributes<HTMLDivElement> {
  backHref: string;
  /** @default "Content" */
  backLabel?: ReactNode;
  /** the page's h1 (Figma `admin page title`, exposed) */
  title: ReactNode;
  /** "Shown on: …" */
  where?: ReactNode;
  /** View on shop + Save (Buttons), desktop only */
  actions?: ReactNode;
}
export declare function ContentEditorHead(props: ContentEditorHeadProps): JSX.Element;

/** Figma `link row` (BACKEND → Content, layout inline | stacked, decision 0106): a label + link pair with Remove. */
export interface LinkRowProps extends HTMLAttributes<HTMLDivElement> {
  /** the Label Input */
  label: ReactNode;
  /** the Link Input */
  link: ReactNode;
  /** Remove. Omit → no button */
  onRemove?: () => void;
  /** @default "Remove" */
  removeLabel?: string;
  /** inline = label 160 + link, side by side (stacked below the breakpoint anyway). @default "inline" */
  layout?: 'inline' | 'stacked';
}
export declare function LinkRow(props: LinkRowProps): JSX.Element;

/** Figma `section row` (BACKEND → Content, decision 0106): one section of a page (heading + text) or one step, with Remove. */
export interface SectionRowProps extends HTMLAttributes<HTMLDivElement> {
  /** the heading (or step title) Input */
  heading: ReactNode;
  /** the text Input (text area) */
  text: ReactNode;
  /** Remove. Omit → no button */
  onRemove?: () => void;
  /** @default "Remove" */
  removeLabel?: string;
}
export declare function SectionRow(props: SectionRowProps): JSX.Element;

/** Mirrors the Figma component `progress bar` (COMPONENTS → admin): a determinate bar, 4px, track surface/subtle,
 *  value action/primary/background/default. role="progressbar"; pass aria-label (or aria-labelledby). Decision 0091. */
export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** Percent done, 0–100 (clamped, rounded). Figma: width of the `value` layer. */
  value: number;
}
export declare function ProgressBar(props: ProgressBarProps): JSX.Element;

/** Mirrors the Figma component `admin bar` (page `admin`, device=desktop | mobile, one responsive markup, decision 0089).
 *  No Create button since decision 0125: Create listing is on the Listings page (`ListingsHead`). */
export interface AdminBarProps extends HTMLAttributes<HTMLElement> {
  /** Desktop section buttons, in order. `current` = the section you are on (Button state=active, aria-current). */
  items?: { href: string; label: ReactNode; current?: boolean }[];
  /** Mobile title (Figma `title`). @default "Store admin" */
  title?: ReactNode;
  /** Desktop: the signed-in email (body/small, text/moderate). */
  email?: ReactNode;
  /** Desktop Sign out. Omit → no button (on mobile Sign out is in the menu). */
  onSignOut?: () => void;
  /** @default "Sign out" */
  signOutLabel?: string;
  /** Mobile Menu button: opens the page's menu dialog (a MenuLayer). */
  onMenuClick?: () => void;
  /** @default "Menu" */
  menuLabel?: string;
  /** Extra attributes for the Menu button (aria-expanded, aria-controls). */
  menuProps?: object;
  /** Accessible name of the desktop <nav>. @default "Admin" */
  navLabel?: string;
}
export declare function AdminBar(props: AdminBarProps): JSX.Element;

/** Mirrors the Figma component `listings head` (page BACKEND → Listings, device=desktop | mobile, one responsive markup,
 *  decision 0125): the Listings page title + the ways to add records. Desktop = one row, actions right; mobile = actions
 *  under the title. */
export interface ListingsHeadProps extends HTMLAttributes<HTMLDivElement> {
  /** The page heading (h1, label/extra-large). @default "Listings" */
  title?: ReactNode;
  /** Create listing link (Button primary). Omit → no button. */
  createHref?: string;
  /** @default "Create listing" */
  createLabel?: ReactNode;
}
export declare function ListingsHead(props: ListingsHeadProps): JSX.Element;

/** Mirrors the Figma component `stat` (page BACKEND → Dashboard, decision 0169): one figure of the admin Dashboard.
 *  Divider on top, label, value, optional note and link (Figma booleans `note` and `link`). */
export interface StatProps extends HTMLAttributes<HTMLDivElement> {
  /** What is counted (body/small, text-moderate). */
  label: ReactNode;
  /** The figure (label/extra-large), already formatted: "12", "1,240 €". */
  value: ReactNode;
  /** How it is counted, or a split ("8 online · 4 off the site"). Omit → no note. */
  note?: ReactNode;
  /** Where the figure comes from (the list behind it). Omit → no link. */
  href?: string;
  /** @default "View" */
  linkLabel?: ReactNode;
}
export declare function Stat(props: StatProps): JSX.Element;

/** Mirrors the Figma component `crate photo head` (page BACKEND → Crate photo, decision 0200): page title + the listing it adds photos to. */
export interface CratePhotoHeadProps extends HTMLAttributes<HTMLDivElement> {
  /** h1, label/extra-large. @default "Take photo" */
  title?: ReactNode;
  /** "SKU · Artist – Title" (body/small, text-moderate). Omit → no line. */
  listing?: ReactNode;
}
export declare function CratePhotoHead(props: CratePhotoHeadProps): JSX.Element;

/** Mirrors the Figma component `side switch` (Crate photo, 0200): which label side the photo is, two secondary Buttons, the chosen one state=active. */
export interface SideSwitchProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** The chosen side, e.g. "A". */
  value: string;
  onChange?: (side: string) => void;
  /** [value, label] pairs. @default [["A", "Label A"], ["B", "Label B"]] */
  sides?: [string, ReactNode][];
}
export declare function SideSwitch(props: SideSwitchProps): JSX.Element;

/** Mirrors the Figma component `camera viewer` (Crate photo, 0200): the 3:4 live camera with an on-screen guide (record edge 7",
 *  label crop 3.8", the 4 markers of the optional A4 sheet) that is never in the photo, and a status pill. */
export interface CameraViewerProps extends HTMLAttributes<HTMLDivElement> {
  /** Status pill text, e.g. "Sheet found". Figma `status`. */
  status?: ReactNode;
  /** Figma `show status`. @default true (shown when `status` is set) */
  showStatus?: boolean;
  /** Figma `guide`. @default true */
  guide?: boolean;
  /** The feed: a <video> (or a <canvas>), covers the viewer. Figma `feed`. */
  children?: ReactNode;
}
export declare function CameraViewer(props: CameraViewerProps): JSX.Element;

/** Mirrors the Figma component `crop preview` (Crate photo, 0200): a square crop and its caption. */
export interface CropPreviewProps extends HTMLAttributes<HTMLElement> {
  /** "Full · 180 mm" (body/small, text-moderate). */
  caption: ReactNode;
  /** The image: a <canvas> or <img>, fills the square (surface/media while empty). Figma `photo`. */
  children?: ReactNode;
}
export declare function CropPreview(props: CropPreviewProps): JSX.Element;

/** Mirrors the Figma component `turn bar` (Crate photo, 0200): hint · angle · 90° · Reset. */
export interface TurnBarProps extends HTMLAttributes<HTMLDivElement> {
  /** @default "Drag a photo to turn" */
  hint?: ReactNode;
  /** The angle, e.g. "+12.5°". Figma `angle`. */
  angle: ReactNode;
  onTurn?: () => void;
  onReset?: () => void;
  /** @default "90°" */
  turnLabel?: ReactNode;
  /** @default "Reset" */
  resetLabel?: ReactNode;
  disabled?: boolean;
}
export declare function TurnBar(props: TurnBarProps): JSX.Element;

/** Mirrors the Figma component `check line` (Crate photo, 0200): what was applied (done) or which fallback was used (warning). */
export interface CheckLineProps extends HTMLAttributes<HTMLDivElement> {
  /** done = check-circle, warning = warning-circle and moderate text. @default "done" */
  state?: "done" | "warning";
  /** The message (body/small). */
  children: ReactNode;
}
export declare function CheckLine(props: CheckLineProps): JSX.Element;

/** Create bargain capture (Figma `capture slot`, decision 0204). With onClick it renders a button (taken: retake). */
export interface CaptureSlotProps extends HTMLAttributes<HTMLElement> {
  /** "Label A" | "Label B" */
  side: ReactNode;
  /** default "next" */
  state?: 'now' | 'taken' | 'next' | 'skipped';
  /** replaces the default state line ("Now", "Taken · tap to retake", "Next", "Skipped") */
  stateText?: ReactNode;
  /** taken: the photo (a canvas or img) in the 40 px thumb */
  children?: ReactNode;
}
export declare function CaptureSlot(props: CaptureSlotProps): JSX.Element;
/** Figma `capture progress`: the two CaptureSlots + an optional note (what is saving / saved). */
export interface CaptureProgressProps extends HTMLAttributes<HTMLDivElement> {
  note?: ReactNode;
  children?: ReactNode;
}
export declare function CaptureProgress(props: CaptureProgressProps): JSX.Element;
/** Figma `label review`: a CropPreview (children = the canvas) + 90° and Retake. */
export interface LabelReviewProps extends HTMLAttributes<HTMLDivElement> {
  caption?: ReactNode;
  onTurn?: () => void;
  onRetake?: () => void;
  disabled?: boolean;
  children?: ReactNode;
}
export declare function LabelReview(props: LabelReviewProps): JSX.Element;

/** Mirrors the Figma component `listings filter` (page BACKEND → Listings, device=desktop | mobile, one responsive markup,
 *  decision 0128): the status tabs of the Listings page + the search that filters its rows. Desktop = one row, search
 *  280 on the right; mobile = tabs, then the search full width. */
export interface ListingsFilterProps extends HTMLAttributes<HTMLDivElement> {
  /** The status tabs: a <Tabs> (Live · Drafts · Sold · Archived). */
  tabs: ReactNode;
  /** The search field: an <Input variant="search"> with aria-label and placeholder. Omit → tabs only. */
  search?: ReactNode;
}
export declare function ListingsFilter(props: ListingsFilterProps): JSX.Element;

/** Figma `product image` (page `media`) at 40 × 40 (decision 0123): a record's photo in an admin list (ListingRow, the
 *  Listings table). Decorative by default (empty alt, aria-hidden): the row's title names the record. */
export interface ThumbnailProps extends HTMLAttributes<HTMLSpanElement> {
  /** Photo URL: pass the small copy (decision 0108, the 200 px one). Omit → the empty square (surface/media). */
  src?: string;
  /** Optional srcset of the same photo; `sizes` defaults to 40px. */
  srcSet?: string;
  sizes?: string;
  /** Alt text. Empty (default) = decorative, hidden from screen readers. */
  alt?: string;
}
export declare function Thumbnail(props: ThumbnailProps): JSX.Element;

/** Mirrors the Figma component `listing row` (page `admin`, decision 0089): a row of an admin list on mobile, in a <ul>. */
export interface ListingRowProps extends HTMLAttributes<HTMLLIElement> {
  /** The element: 'li' in a list (default), 'div' inside another row (OfferRow). @default "li" */
  as?: 'li' | 'div';
  /** Figma boolean `handle` (decision 0129): a DragHandle, before the select. Omit → fixed order. */
  handle?: ReactNode;
  /** A Checkbox with hideLabel (accessible name "Select <record>"). Omit → no select column. */
  select?: ReactNode;
  /** Figma `thumbnail` + boolean `show thumbnail` (decision 0123): the record's first photo as a Thumbnail.
   *  `{}` (no src) → the empty square; omit → no thumbnail column (Attributes rows). */
  image?: ThumbnailProps;
  /** The record (Figma `record`): a link to its edit page. */
  title: ReactNode;
  href: string;
  /** Figma `meta`, e.g. "0048 · Draft · sale". */
  meta?: ReactNode;
  /** Figma `price` + boolean `show price`. Omit → no price. */
  price?: ReactNode;
}
export declare function ListingRow(props: ListingRowProps): JSX.Element;

/** Mirrors the Figma component `offer row` (BACKEND → Offers, device=desktop | mobile, state=new | decided; decision 0158). */
export interface OfferRowProps extends Omit<HTMLAttributes<HTMLLIElement>, 'title'> {
  /** The record, as a ListingRow without select / handle: price = the offer. */
  record: { image?: ThumbnailProps; title: ReactNode; href?: string; meta?: ReactNode; price?: ReactNode };
  /** Who and where, e.g. "buyer@example.com · ships to Germany". */
  buyer: ReactNode;
  /** The buyer's note (Figma boolean `show note`). */
  note?: ReactNode;
  /** When the offer arrived (text/moderate). */
  date?: ReactNode;
  /** state=new: the Accept / Decline Buttons. */
  actions?: ReactNode;
  /** state=decided: the status line (used when there are no actions). */
  status?: ReactNode;
}
export declare function OfferRow(props: OfferRowProps): JSX.Element;

/** Figma `drag handle` (icon bars-three 24, in `file item`, `listing row`, `listings table row`; decision 0129): the
 *  chromeless button of a reorderable row. ↑ ↓ move the row by one; pointer drags start on the whole row (useDragOrder). */
export interface DragHandleProps extends HTMLAttributes<HTMLButtonElement> {
  /** Shown position of the row, 0-based. */
  index: number;
  count: number;
  /** (from, to): useDragOrder's keyboardMove. */
  onMove: (from: number, to: number) => void;
  /** The row's name, for the default label "Move <name>, position n of m (arrow up / down)". */
  name?: string;
  label?: string;
}
export declare function DragHandle(props: DragHandleProps): JSX.Element;

/** The one drag & drop order of the admin (decision 0129; FileList uses it). Spread `listProps` on the list element
 *  (<ol>, <ul>, <tbody>) and `rowProps(i)` on each row; `slot(i).pos` = where row i shows during a drag. */
export declare function useDragOrder(opts: {
  count: number;
  keyOf: (i: number) => string | number;
  nameOf?: (i: number) => string | undefined;
  /** null/undefined = fixed order (no drag). */
  onMove?: ((from: number, to: number) => void) | null;
  /** The handle that keeps the focus after a keyboard move. @default ".hm-drag-handle" */
  handleSelector?: string;
}): {
  listRef: { current: HTMLElement | null };
  listProps: Record<string, unknown>;
  rowProps: (i: number) => Record<string, unknown>;
  slot: (i: number) => { pos: number; dy: number };
  keyboardMove: ((from: number, to: number) => void) | null;
  drag: unknown;
  live: string;
};

/** Mirrors the Figma component `order block` (page `Orders`, BACKEND, decision 0100): one block of the admin order page. */
export interface OrderBlockProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Figma `title`, e.g. "Ship to". Rendered as <h2>. */
  title: ReactNode;
  /** Figma `body`: plain text, line breaks kept (an address, the totals). */
  children?: ReactNode;
  /** Figma `action` (boolean, on): a Button (hug), e.g. "Copy address". Omit → no action. */
  action?: ReactNode;
}
export declare function OrderBlock(props: OrderBlockProps): JSX.Element;

/** Mirrors the Figma component `action bar` (page `admin`, decision 0089): form actions sticky at the bottom of the viewport on mobile. */
export interface ActionBarProps extends HTMLAttributes<HTMLDivElement> {
  /** The Buttons, primary first, side by side. Figma: `primary`, `secondary` (boolean, on). */
  children?: ReactNode;
  /** A line above the buttons (e.g. the save result, role=status). */
  status?: ReactNode;
}
export declare function ActionBar(props: ActionBarProps): JSX.Element;

/** Figma `newsletter dialog` (page dialog, decision 0121): the newsletter signup as a modal. A native <dialog>, rendered closed; the page opens it. */
export interface NewsletterDialogProps extends HTMLAttributes<HTMLDialogElement> {
  /** id of the <dialog> (its title and body ids derive from it). @default "hm-newsletter-dialog" */
  id?: string;
  /** Figma `title`. @default "Get new records first" */
  title?: ReactNode;
  /** Figma `body`. @default "Get them in your inbox as they’re listed." */
  body?: ReactNode;
  /** Accessible name of the close icon button. @default "Close" */
  closeLabel?: string;
  /** The form: a FooterNewsletter with `hideLabel`. */
  children?: ReactNode;
}
export declare function NewsletterDialog(props: NewsletterDialogProps): JSX.Element;

/** Figma `section head` (page Home, decision 0120): heading of a home section. Divider on top, title + inline meta, actions on the right. */
export interface SectionHeadProps extends HTMLAttributes<HTMLDivElement> {
  /** Figma `title` (body/medium, text/strong). */
  title: ReactNode;
  /** Figma `meta text` (boolean `meta`): an inline count after the title, e.g. "(12)", text/moderate. Omit → none. */
  meta?: ReactNode;
  /** Heading level of the title. @default 2 */
  headingLevel?: 2 | 3 | 4;
  /** Figma boolean `divider`. @default true */
  divider?: boolean;
  /** Figma boolean `actions` (`play`, `see all`): secondary Buttons ("Play all", "See all"). Omit → no actions. */
  actions?: ReactNode;
  /** id of the title, to name the section (aria-labelledby). */
  titleId?: string;
}
export declare function SectionHead(props: SectionHeadProps): JSX.Element;

/** Figma `genre links` (page Home, layout row | column): the catalogue's genres as Tag links (size large) + "All". A <nav> named "Genres". */
export interface GenreLinksProps extends HTMLAttributes<HTMLElement> {
  /** The genres, in order. */
  genres: { label: ReactNode; href: string }[];
  /** Figma `layout`: row = wrapping, column = one per line; responsive = column on desktop, row on mobile. @default "responsive" */
  layout?: 'row' | 'column' | 'responsive';
  /** "All" (Button secondary extra-small, own line): the link to every record (the shop: /sale/). Omit → no All. */
  allHref?: string;
  /** @default "All" */
  allLabel?: ReactNode;
}
export declare function GenreLinks(props: GenreLinksProps): JSX.Element;

/** Figma `home intro` (page Home, device desktop | mobile): the welcome line at the top of the home. A <p>; links inside are underlined. */
export interface HomeIntroProps extends HTMLAttributes<HTMLParagraphElement> {
  /** desktop = body/extra-large, mobile = body/large, responsive = both by breakpoint. @default "responsive" */
  device?: 'desktop' | 'mobile' | 'responsive';
  children?: ReactNode;
}
export declare function HomeIntro(props: HomeIntroProps): JSX.Element;

/** Figma `collection card` (page Home, state default | hover, decision 0174): a link to a collection page, label centered. An <a>. */
export interface CollectionCardProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** The collection name (label/large, uppercase by the type style). */
  label: ReactNode;
  /** Figma `state`, for docs only; the page uses :hover. */
  state?: 'default' | 'hover';
}
export declare function CollectionCard(props: CollectionCardProps): JSX.Element;

/** Figma `home collections` (page Home, device desktop | mobile, decision 0174): the collection cards under the home intro. A <nav> with a list. */
export interface HomeCollectionsProps extends HTMLAttributes<HTMLElement> {
  /** The cards, in Gio's order (admin → Collections). */
  collections: { label: ReactNode; href: string }[];
  /** desktop = 4 per row, mobile = 2 per row, responsive = by breakpoint. @default "responsive" */
  device?: 'desktop' | 'mobile' | 'responsive';
}
export declare function HomeCollections(props: HomeCollectionsProps): JSX.Element;

/** Figma `home newsletter` (page Home): the signup between two shelves, in a dashed box (the store name's dash). A <section>. */
export interface HomeNewsletterProps extends HTMLAttributes<HTMLElement> {
  /** The SectionHead title. @default "Get new records first" */
  title?: ReactNode;
  /** @default 2 */
  headingLevel?: 2 | 3 | 4;
  /** Figma `device`: the box width is set by the page (desktop: 2 of 3 tile columns; mobile: fill). @default "responsive" */
  device?: 'desktop' | 'mobile' | 'responsive';
  /** The form: a FooterNewsletter with `hideLabel`. */
  children?: ReactNode;
}
export declare function HomeNewsletter(props: HomeNewsletterProps): JSX.Element;

/** Figma `product tile` (page `product card`, device desktop | mobile × state default | hover): a record in a home shelf (grid view). An <article>. */
export interface ProductTileProps extends HTMLAttributes<HTMLElement> {
  /** desktop = the cover; mobile = every photo in a horizontal swipe gallery + counter; responsive = by breakpoint. @default "responsive" */
  device?: 'desktop' | 'mobile' | 'responsive';
  /** Doc-only pin of the interaction state (hover comes from :hover on pointer devices). */
  state?: 'default' | 'hover';
  /** The photos, cover first (1:1). */
  images?: { src: string; srcSet?: string; sizes?: string; alt?: string }[];
  /** The product page: the media becomes its link. */
  href?: string;
  /** Figma `product name`. */
  title: ReactNode;
  /** Figma `release info`. */
  releaseInfo?: ReactNode;
  /** Figma `price`. */
  price?: ReactNode;
  /** Figma `samples`: PlayerButtons, right of the price, wrapping. */
  samples?: ReactNode;
  /** Figma `button` (fill): e.g. a secondary Button "Add to bag". */
  action?: ReactNode;
  /** Figma boolean `counter`: the gallery counter on mobile, shown only with more than one photo. @default true */
  counter?: boolean;
  /** @default 3 */
  headingLevel?: 2 | 3 | 4;
}
export declare function ProductTile(props: ProductTileProps): JSX.Element;

/** Figma `gallery counter`: "1/3" on a photo, body/extra-small text/strong on surface/accent. */
export interface GalleryCounterProps extends HTMLAttributes<HTMLSpanElement> {
  /** Figma `count`, e.g. "1/3". */
  children?: ReactNode;
}
export declare function GalleryCounter(props: GalleryCounterProps): JSX.Element;

/** Figma `view toggle` (page Home, view grid | list): a secondary Button that switches a list between tiles and cards. Its label names the other view. */
export interface ViewToggleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The view shown now: grid → "List view" (icon bars-three); list → "Grid view" (icon: TODO in Figma). @default "grid" */
  view?: 'grid' | 'list';
}
export declare function ViewToggle(props: ViewToggleProps): JSX.Element;

/** Mirrors the Figma component `form section head` (BACKEND → Create, 2026-11-17): the heading of a Create / Edit listing section. */
export interface FormSectionHeadProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Heading level. @default 2 */
  headingLevel?: 2 | 3 | 4;
  /** The id the section's aria-labelledby points at. */
  id?: string;
}
export declare function FormSectionHead(props: FormSectionHeadProps): JSX.Element;


/** Mirrors the Figma component `marker` (page `listing form`, 2026-11-17): a 48px circle that draws the eye to a form block. Decorative (aria-hidden). */
export interface MarkerProps extends HTMLAttributes<HTMLSpanElement> {
  /** Figma TEXT `text`: a line number, "€€"… */
  children?: ReactNode;
}
export declare function Marker(props: MarkerProps): JSX.Element;

/** Mirrors the Figma component `price fields` (page `Create`, device=desktop | mobile, 2026-11-17): Marker + Sale type + Price. */
export interface PriceFieldsProps extends HTMLAttributes<HTMLDivElement> {
  /** The Marker text. @default "€€" */
  marker?: ReactNode;
  /** Sale type select (Input variant select). Desktop: 2 of 8 columns. */
  saleType?: ReactNode;
  /** Price Input. Desktop: 2 of 8 columns. */
  price?: ReactNode;
  /** price=offers (decision 0158): a note in place of Price (Best offer has no price). Desktop: 6 of 8 columns. */
  note?: ReactNode;
  /** Figma boolean `paid` (decision 0206): the "Paid" Input (what the seller paid, private). Desktop: 2 of 8 columns, after Price or after the note (the note then takes 4). Omit = off. */
  paid?: ReactNode;
  /** Figma boolean `bargain crate` (decision 0201): the "Bargain crate" Checkbox, on a row of its own under the fields. Omit = off. */
  bargain?: ReactNode;
}
export declare function PriceFields(props: PriceFieldsProps): JSX.Element;
