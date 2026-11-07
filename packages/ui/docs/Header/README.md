# Header

The site header: logo and store name on the left, section tabs in the middle (desktop), actions on the right, a 1px rule below. A composition of `Button` and `Tabs` — it defines no colors or type of its own.

## API

| Prop | Values | Figma |
| --- | --- | --- |
| `device` | `desktop` · `mobile` · omitted = responsive | variant `device` |
| `logo` | `<img>` / `<svg>` — 64px desktop, 48px mobile | `image 2` |
| `storeName` | text in the bordered box | `Store-name` |
| `homeHref` | URL — makes the store name a link | — |
| `tabs` | a `<Tabs>` element; desktop only | `tab group` |
| `actions` | trailing `<Button hierarchy="secondary">`s | `trailing actions` |
| `onMenuClick` / `menuLabel` | mobile hamburger button | leading icon-only `button` |

With `device` omitted the header renders one markup and CSS switches the menu button / tabs / logo size at the breakpoint `--mobile` (**tokens.json → breakpoint, <768px placeholder**; Figma has none, its frames are fill). The header itself is always full width. Pass `device` to pin a variant (documentation, tests).

## Tokens used

- Store-name border (1px **dashed**, Figma dashPattern [8,8]) and bottom rule: `border-divider-strong`
- Everything else comes from `Button` and `Tabs`

## Dimensions (hardcoded, as in Figma)

padding-top 8 · leading/trailing gap 8 · row `space-between`, top-aligned · logo 64 (desktop) / 48 (mobile) · store-name box padding 8, `label-medium` · rule 1px · mobile frame 375.

## Placement (Figma: section `layout`)

The header sits at the top of the page container, full width inside its horizontal padding:

```css
.page { background: var(--surface-base); padding: 0 var(--page-margin-desktop); } /* 1024 */
.page[data-device="mobile"] { padding: 0 var(--page-margin-mobile); }          /* 375 */
```

Both margins are 8px today. The preview shows the header inside this container (dashed outline = page frame).

## Open

- `icon/hamburger-menu-ultra` contains an empty `Union` (width 0).
- Breakpoint value (<768px) still to confirm; it lives only in tokens.json.
