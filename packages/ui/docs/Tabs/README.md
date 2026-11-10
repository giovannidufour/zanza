# Tabs

A horizontal tablist (`Tabs`, Figma `tab group`) of `Tab` items (Figma `tab`). `Tabs` owns the selection: a tab is active only when `Tabs.value === Tab.value`. There is no `disabled` and no `size` in Figma, so none here.

## API

<!-- api: TabsProps TabProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
### Tabs

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` * | `string` |  | The `value` of the selected Tab. Controlled. |
| `onValueChange` | `(value: string) => void` |  | Called with the `value` of the Tab the user picks (click or ← → Home End). |
| `as` | `"nav"` |  | `"nav"` when the tabs are site navigation (links with href): no tablist semantics, no keyboard roving. |
| `children` * | `ReactNode` |  | &lt;Tab> elements. |

### Tab

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` * | `string` |  | Identity of this tab inside its Tabs. |
| `href` | `string` |  | When set, renders an &lt;a> (site navigation) with aria-current="page" if selected, instead of role="tab". |
| `children` * | `ReactNode` |  | Label text. Rendered uppercase by the label text style. |
| `leadingIcon` | `ReactNode` |  | Icon slot before the label (20px). Figma: `leading icon`. |
| `trailingIcon` | `ReactNode` |  | Icon slot after the label (20px). Figma: `trailing icon`. |
| `suffix` | `ReactNode` |  | Text after the label, same style, gap 4: a count ("Artists" + 64). Figma: `suffix` + `suffix text`. |
| `state` | `"default" \| "hover" \| "pressed" \| "active"` |  | Documentation only: pins a visual state regardless of pointer/selection. |

`*` required.
<!-- /api -->

**Navigation use** (header For sale / For trade): `<Tabs as="nav">` + `<Tab href>` render a `<nav>` of links with `aria-current="page"`: no tablist semantics, because they change page, not a panel.

## Accessibility

WAI-ARIA tabs pattern: `role="tablist"` / `role="tab"`, `aria-selected`, roving `tabIndex`, `←` `→` `Home` `End` move and select. Consumers add `aria-controls` / `role="tabpanel"`.

## Tokens

- Background `tab-background-{default|hover|pressed|active}`: transparent ×3, `white` when active
- Border (1px) `tab-border-*`, always black: the pattern carries the state ([0005](../../../../design/decisions/0005-border-pattern-carries-state.md))
- Label `text-strong`, icons `icon-strong`, type `label-medium`

## Dimensions (Figma)

padding 8 · icon ↔ label gap 8 · list gap 8 · icon 20.
