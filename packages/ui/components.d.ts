import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, InputHTMLAttributes, ReactNode, Ref } from "react";

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
  /** Label text. Rendered uppercase by the label text style. Omit for an icon-only button — then `aria-label` is required. */
  children?: ReactNode;
  /** Documentation only: pins a visual state regardless of pointer. Do not use in product code. */
  state?: "default" | "hover" | "pressed" | "disabled";
  /** When set, renders an <a> styled as the button (navigation). */
  href?: string;
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
  /** Link target; omitted or null = plain text. Ignored on the last item. */
  href?: string | null;
}
export interface BreadcrumbsProps extends HTMLAttributes<HTMLElement> {
  /** In order; the last item is the current page (never a link, aria-current="page"). */
  items: Array<BreadcrumbItem | string>;
}
export declare function Breadcrumbs(props: BreadcrumbsProps): JSX.Element;

/** Mirrors the Figma component `tag item`: a static label chip on surface-support-1. */
export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
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
  /** Cover of the product, 48 × 48. Figma: `product image`. */
  image?: { src: string; alt?: string };
  /** Track position on the record, e.g. "A". Figma: `sample number`. */
  trackPosition?: ReactNode;
  /** The sample title, e.g. "Vocal". Figma: first `product name` text. */
  sampleTitle: ReactNode;
  /** "Artist - Title". Figma: second `product name` text. */
  productName: ReactNode;
  /** 1-based position of the sample in the queue ("1 of 3"). Previous is disabled at 1. @default 1 */
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
  /** Figma `Grading: …`, already formatted. */
  grading?: ReactNode;
  /** <PlayerButton>s. Desktop: columns 2–3, stacked; mobile: full width, in a row. */
  samples?: ReactNode;
}
export declare function ProductInfo(props: ProductInfoProps): JSX.Element;

/** Mirrors the Figma component `product card` (device=desktop | mobile): a release in a list. One markup; CSS grid places
 *  the blocks per variant (the description moves from the purchase column on desktop to the info column on mobile). */
export interface ProductCardImage {
  /** Cover URL. Omitted → the empty square (surface/support-1). */
  src?: string;
  /** Alt text; empty = decorative (the title already names the release). */
  alt?: string;
}
export interface ProductCardProps extends HTMLAttributes<HTMLElement> {
  /** Omitted → responsive (breakpoint `--mobile` from tokens.json, <768px placeholder). */
  device?: "desktop" | "mobile";
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
  /** Figma `grading`, already formatted. */
  grading?: ReactNode;
  /** Tag labels. Rendered as a TagGroup: size large on desktop, small on mobile. */
  tags?: string[];
  /** <PlayerButton>s, in a row (gap 8). */
  samples?: ReactNode;
  /** Click on the add button. */
  onAdd?: () => void;
  /** Desktop button label (Figma: "Add to bag"). Default "Add to bag". */
  addLabel?: string;
  /** Mobile button label (Figma: "Add"). Default "Add". */
  addLabelShort?: string;
}
export declare function ProductCard(props: ProductCardProps): JSX.Element;

/** Titled list of product cards below the product (Figma: PDP `you may also like`). Same layout on desktop and mobile: the cards carry the device. */
export interface RelatedProductsProps extends HTMLAttributes<HTMLElement> {
  /** Figma `title` (PDP: "More for sale:"). Rendered as a heading; it also names the section. */
  title: ReactNode;
  /** Heading level of the title; give the cards' titles the next level. @default 2 */
  headingLevel?: 2 | 3 | 4;
  /** Figma slot `products list`: <ProductCard>s, stacked (gap 8). */
  children?: ReactNode;
}
export declare function RelatedProducts(props: RelatedProductsProps): JSX.Element;

/** Product images: 2 per product. Desktop: big + half-width below; mobile: horizontal swipe. Mirrors the PDP placement (no Figma gallery component yet). */
export interface GalleryImage {
  /** Image URL. */
  src: string;
  /** Alt text; empty = decorative. */
  alt?: string;
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
  variant?: "text-field" | "search" | "select";
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
  /** Figma `leading icon` (20px). Default: SearchIcon for search, none otherwise. */
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
  /** Image file: the 40 × 40 thumbnail (empty = surface-support-1). */
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

/** Mirrors the Figma component `divider` (page `divider`): a 1px rule in border/divider/strong, full width. Renders <hr>. */
export interface DividerProps extends HTMLAttributes<HTMLHRElement> {}
export declare function Divider(props: DividerProps): JSX.Element;

/** Mirrors the Figma component `action panel` (page `listing form`): surface/subtle, padding 16, a column of Buttons that fill it, gap 8. */
export interface ActionPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** The Buttons, primary first (Figma: `primary`, `secondary`, `tertiary`; `tertiary` boolean = pass two or three). */
  children?: ReactNode;
}
export declare function ActionPanel(props: ActionPanelProps): JSX.Element;

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
}
export declare function Dialog(props: DialogProps): JSX.Element;

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

/** Figma `entity chip` (page tags; state default | hover | focus): `tag item` medium + a 24×24 remove button. */
export interface EntityChipProps extends HTMLAttributes<HTMLSpanElement> {
  label?: ReactNode;
  /** Remove button handler; its accessible name is `removeLabel` or "Remove <label>". */
  onRemove?: () => void;
  removeLabel?: string;
  /** Documentation only: pins the Figma state. Do not use in product code. */
  state?: "default" | "hover" | "focus";
}
export declare function EntityChip(props: EntityChipProps): JSX.Element;
export declare function XThinIcon(): JSX.Element;
export declare function PlusSmallThinIcon(): JSX.Element;

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

/** Mirrors the Figma component `filter` (page filters): a native checkbox, 16px box, gap 8, label body/small, count body/small text-moderate. */
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
  /** The facet ("Subgenre", "Format"). Figma: `Label`. */
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
