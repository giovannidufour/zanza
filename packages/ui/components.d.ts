import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

/** Mirrors the Figma component `button` — variants hierarchy × size, states via pseudo-classes. */
export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Visual weight. Figma: `hierarchy`. */
  hierarchy?: "primary" | "secondary";
  /** Figma: `size`. large = 44px, medium = 36px, extra-small = 22px. */
  size?: "large" | "medium" | "extra-small";
  /** Native disabled; also drives the disabled visual state. */
  disabled?: boolean;
  /** Icon slot before the label. Pass an <svg>; it is sized and colored by the button. Figma: `leading icon`. */
  leadingIcon?: ReactNode;
  /** Icon slot after the label. Figma: `trailing icon`. */
  trailingIcon?: ReactNode;
  /** Label text. Rendered uppercase by the label text style. Omit for an icon-only button — then `aria-label` is required. */
  children?: ReactNode;
  /** Documentation only: pins a visual state regardless of pointer. Do not use in product code. */
  state?: "default" | "hover" | "pressed" | "disabled";
}

export declare function Button(props: ButtonProps): JSX.Element;

/** Mirrors the Figma component `header` (device=desktop | mobile). A composition of logo, store name, Tabs and actions. */
export interface HeaderProps extends HTMLAttributes<HTMLElement> {
  /** Which Figma variant to render. Omitted → responsive: one markup, CSS switches menu/tabs/logo size (breakpoint `--mobile` from tokens.json, <768px placeholder). */
  device?: "desktop" | "mobile";
  /** Logo image (<img> or <svg>). 64×64 on desktop, 48×48 on mobile. Figma: `image 2`. */
  logo?: ReactNode;
  /** Store name shown in the bordered label box. Figma: `Store-name`. */
  storeName?: ReactNode;
  /** When set, the store name becomes a link to this URL. */
  homeHref?: string;
  /** A <Tabs> element. Rendered on desktop only (Figma: no tabs in the mobile variant). */
  tabs?: ReactNode;
  /** Trailing actions, usually secondary <Button>s (Figma: `trailing actions`, gap 8). */
  actions?: ReactNode;
  /** Mobile only: click handler of the hamburger button. */
  onMenuClick?: () => void;
  /** Mobile only: accessible name of the hamburger button. Default "Menu". */
  menuLabel?: string;
}
export declare function Header(props: HeaderProps): JSX.Element;

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
  /** Documentation only: pins a visual state regardless of pointer/selection. */
  state?: "default" | "hover" | "pressed" | "active";
}
export declare function Tab(props: TabProps): JSX.Element;

/** Mirrors the Figma component `breadcrumbs`: body-medium items separated by "/", 1px rule below. */
export interface BreadcrumbItem { label: ReactNode; href?: string | null; }
export interface BreadcrumbsProps extends HTMLAttributes<HTMLElement> {
  /** In order; the last item is the current page (never a link, aria-current="page"). */
  items: Array<BreadcrumbItem | string>;
}
export declare function Breadcrumbs(props: BreadcrumbsProps): JSX.Element;

/** Mirrors the Figma component `tag item`: a static label chip on surface-support-1. */
export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  /** Figma: `size`. extra-small = 18px, small = 22px, medium = 24px, large = 28px. */
  size?: "extra-small" | "small" | "medium" | "large";
  children: ReactNode;
}
export declare function Tag(props: TagProps): JSX.Element;

/** Mirrors the Figma component `tag group`: a wrapping list of <Tag>s, gap 4. Figma's `orientation` axis is not ported (both variants are horizontal). */
export interface TagGroupProps extends HTMLAttributes<HTMLUListElement> {
  children: ReactNode;
}
export declare function TagGroup(props: TagGroupProps): JSX.Element;

/** Mirrors the Figma component `player button`: play/pause icon + label, no chrome. */
export interface PlayerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Figma: state=playing. Also sets aria-pressed. */
  playing?: boolean;
  /** Label (body-medium): the sample / track name. */
  children: ReactNode;
}
export declare function PlayerButton(props: PlayerButtonProps): JSX.Element;

/** Mirrors the Figma component `product info` (device=desktop | mobile): the text block of a PDP. */
export interface ProductInfoProps extends HTMLAttributes<HTMLElement> {
  /** Omitted → responsive (breakpoint `--mobile` from tokens.json, <768px placeholder). */
  device?: "desktop" | "mobile";
  /** Figma `product name` — rendered as <h1>. */
  title: ReactNode;
  /** Figma `price`, already formatted. */
  price?: ReactNode;
  /** Figma `release info`, e.g. "Label Format (Country)". */
  releaseInfo?: ReactNode;
  /** A <TagGroup>. */
  tags?: ReactNode;
  /** Figma `Description`. */
  description?: ReactNode;
  /** Figma `Grading: …`, already formatted. */
  grading?: ReactNode;
  /** <PlayerButton>s. Desktop: middle column, stacked; mobile: full width, in a row. */
  samples?: ReactNode;
}
export declare function ProductInfo(props: ProductInfoProps): JSX.Element;

/** Product images: 2 per product. Desktop: big + half-width below; mobile: horizontal swipe. Mirrors the PDP placement (no Figma gallery component yet). */
export interface GalleryImage { src: string; alt?: string; }
export interface GalleryProps extends HTMLAttributes<HTMLDivElement> {
  /** Omitted → responsive (breakpoint `--mobile` from tokens.json, <768px placeholder). */
  device?: "desktop" | "mobile";
  /** In order; the first is the main image. */
  images: GalleryImage[];
}
export declare function Gallery(props: GalleryProps): JSX.Element;
