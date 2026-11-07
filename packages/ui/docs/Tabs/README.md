# Tabs

A horizontal tablist (`Tabs`, Figma `tab group`) of `Tab` items (Figma `tab`). Selection is owned by `Tabs`: a tab is active only when `Tabs.value === Tab.value`, so exactly one tab is active at a time.

## API

### Tabs

| Prop | Values | Figma |
| --- | --- | --- |
| `value` | string — the selected tab | — |
| `onValueChange` | `(value) => void` | — |
| `children` | `<Tab>` elements | slot `slot container` (gap 8) |

### Tab

| Prop | Values | Figma |
| --- | --- | --- |
| `value` | string — identity | — |
| `children` | label text | text `label` |
| `leadingIcon` / `trailingIcon` | `<svg>` (20px) | boolean `leading icon` / `trailing icon` |

`active` is not a prop: it is derived from the parent. `hover` / `pressed` come from pseudo-classes; `data-state` is documentation only. There is no `disabled` state in Figma, so none here.

**Navigation use** (header For sale / For trade): `<Tabs as="nav">` + `<Tab href>` render a `<nav>` of links with `aria-current="page"` on the selected one — no tablist semantics, because they change page, not a panel.

## Accessibility

WAI-ARIA tabs pattern: `role="tablist"` / `role="tab"`, `aria-selected`, roving `tabIndex` (only the active tab is in the tab order), `←` `→` `Home` `End` move and select. Consumers add `aria-controls` / `role="tabpanel"` on their panels.

## Tokens used

- Background: `tab-background-{default|hover|pressed|active}` — transparent, transparent, transparent, `white`
- Border (1px, inside): `tab-border-*` — always `black`; the **pattern** carries the state: solid (default, active), dashed 4/4 (hover), dashed 2/2 (pressed). Dash and gap lengths are animated custom properties (`@property`), so solid → dashed opens the gaps smoothly (150ms ease-out, placeholder: no motion in Figma yet; off with `prefers-reduced-motion`)
- Label `text-strong`, icons `icon-strong`; type `label-medium`

## Dimensions (hardcoded, as in Figma)

padding 8 · gap 8 (icon ↔ label) · list gap 8 · icon 20. Only `medium` exists in Figma, so no `size` prop.

## Open

- Focus style: no token yet.
- Figma `_tab-states` now wraps `_tab-sizes` (size=medium: padding 8, gap 8) — the old `_button-sizes` wiring is fixed.
- Figma `tab` still has `hierarchy` with a single value and a `layout` variant; neither is a prop here.
