# SectionHead · GenreLinks · HomeAbout

The blocks of the home page (decision 0085). Figma: page `Home` → components `section head` (text `title`, booleans `play`, `see all`, `divider`), `genre links`, `home about` (text `bio`, boolean `discogs`). The storefront fills them in `apps/storefront/pages/home.js`.

- SectionHead: Divider on top (off for the first section under the header), then the title (body/large, text/strong) and the actions on the right (secondary Buttons, gap small); gap medium-small.
- GenreLinks: SectionHead without actions + Tag size=medium links, wrapping, gap small (24px chips 8px apart: WCAG 2.5.8).
- HomeAbout: SectionHead + bio + DiscogsCard + an underlined link to /about/, gap medium-small.
- Accessibility: each block is a `<section>` named by its title (`id` → `aria-labelledby`); titles are h2 (the page h1 is the store name, visually hidden).

## API

<!-- api: SectionHeadProps GenreLinksProps HomeAboutProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
### SectionHead

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `title` * | `ReactNode` |  | Figma `title`. |
| `headingLevel` | `2 \| 3 \| 4` | `2` | Heading level of the title. |
| `divider` | `boolean` | `true` | Figma boolean `divider`: false for the first section under the header (the header border is already there). |
| `actions` | `ReactNode` |  | Figma booleans `play` and `see all`: secondary Buttons ("Play all", "See all"). Omit → no actions. |
| `titleId` | `string` |  | id of the title, to name the section (aria-labelledby). |

### GenreLinks

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `title` | `ReactNode` | `Genres` |  |
| `genres` * | `{ label: ReactNode; href: string }[]` |  | The genres, in order. |
| `headingLevel` | `2 \| 3 \| 4` | `2` |  |
| `divider` | `boolean` | `true` | The SectionHead divider. |

### HomeAbout

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `title` | `ReactNode` | `About` |  |
| `headingLevel` | `2 \| 3 \| 4` | `2` |  |
| `divider` | `boolean` | `true` | The SectionHead divider. |
| `children` | `ReactNode` |  | Figma `bio`: one line. |
| `discogs` | `DiscogsCardProps` |  | Figma boolean `discogs`: the DiscogsCard props. Omit → no card. |
| `href` | `string` |  | Link to the About page. Omit → no link. |
| `linkLabel` | `ReactNode` |  | @default "More about me" |

`*` required.
<!-- /api -->
