# ActionPanel

The listing actions at the top of the admin side column (Create: Publish now · Save draft · Preview; a published listing: Update · Save draft · Preview). Figma: page `listing form` → `action panel` (2026-11-10).

## API

<!-- api: ActionPanelProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | `ReactNode` |  | The Buttons, primary first (Figma: `primary`, `secondary`, `tertiary`; `tertiary` boolean = pass two or three). |

`*` required.
<!-- /api -->

## Tokens

Background `surface-subtle` · the Buttons keep their own tokens.

## Dimensions (Figma)

Padding 16 · gap 8 · Buttons fill the width (Figma `button` layout=fill) · width: its column (315 on BACKEND → Create).

Figma has three exposed `button` instances (`primary`, `secondary`, `tertiary` boolean). Disabled and busy states of the buttons follow Button.
