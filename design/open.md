# Open — the only backlog of design gaps

Everything undecided, parked or to fix lives here and nowhere else. When an item is decided it moves to a new file in [`decisions/`](decisions/README.md) and is deleted from this list. Product questions (Q1–Q7) are in [`../_context/open-questions.md`](../_context/open-questions.md).

## Pending decisions

- **Interaction overlay for all clickables.** Reuse `action/floating/background/*` as the hover/pressed tint everywhere, links included? Proposal: rename to `interaction/overlay/*`, add an inverse pair (`white-a4/a8`) for dark surfaces, keep the underline on links (WCAG 1.4.1), implement as a `::before` overlay. See [0007](decisions/0007-floating-actions-foreground-background.md).
- **Focus state.** None designed, none shipped. Needs a `border/focus` token before launch (WCAG 2.4.7). *Parked.*
- **Motion tokens.** 150ms ease-out (dashed border) and 200ms (header reveal) are placeholders. *Parked.*
- **Breakpoint value.** `<768px` is a placeholder in `tokens.json`. See [0004](decisions/0004-one-breakpoint-in-tokens.md).
- **Spacing scale / dimension tokens.** Paddings are hardcoded as in Figma; only `page-margin-*`, `gutter-small`, `small` exist. *Parked.*
- **Type size tokens.** Coming later; until then the classes carry the sizes ([0003](decisions/0003-type-styles-are-classes.md)).
- **PlayerButton disabled.** No strikethrough, unlike Button: intentional?
- **Gallery.** Figma component not designed yet; image placeholder fill `#f2f4f7` has no token. *Parked.*

- **Player track number.** Figma shows "1" next to the title and "1 of 3" in the controls; code maps the first to the track position on the record (A, B) — to confirm.
- **Player "Add to bag".** Rendered, no action yet (no cart).
- **Sample audio.** `audio_url` must be a direct file (mp3/aac/ogg). Sample B uses a reggaefever.ch URL (hotlinking and rights to verify); sample A is still a generated test tone (`public/test-sample-a.mp3`). Depends on Q3.
- **Home link.** `/zanza/` is a meta-refresh page, so the soft navigation falls back to a full load there and the audio stops. Fixes itself with a real home page.

## Accessibility risks

- **IconButton** is exactly 24px: needs ≥ 24px clear space from neighbouring targets.

## Figma to fix

- Variables: `white-0/4/8/16/24` → `white-a*` · `border divider/strong` → `border/divider/strong` · `small`, `medium-small` → `space/*`.
- `_button-sizes`: `size` options ordered large, medium, extra small, small → order by size. Unported `prefix` / `suffix` slots and single-value `active` axis.
- `icon button`: no instance-swap property on the icon · `state=disabled` background bound to `…/default` instead of `…/disabled`.
- `tab`: single-value `hierarchy`, unused `layout` variant.
- `tag group / orientation=vertical` is not vertical · `tag item` gap 8 with one child.
- `product info`: 8 text nodes with hardcoded `#000000` → `text/strong` · placeholder name "Artist 1 - Title 1 / Artist 2 - Title 2" needs a data model for split releases.
- `header` mobile: store-name frame named `logo` (desktop: `store name`).
- `player`: native-player placeholder fill unbound (placeholder only, fine).
- Icons: hamburger lines have a white stroke · `icon-pencil` uses unbound `#212121`.

## Code to do

- DS artifact (https://claude.ai/artifact/9Q7SAYDqDnBAj4MEKLnphz) not republished since the `--mobile` type variants: needs `npm run build:artifact` + publish.
- Component token tables in `docs/*/README.md` are still hand-written (API tables are generated).
