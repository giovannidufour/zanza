# Footer · FooterLinks · FooterNewsletter

The site footer, the same on every shop page, after `<main>` ([0076](../../../../design/decisions/0076-footer.md)). Figma: page `footer` → `footer` (device=desktop | mobile, booleans `newsletter`, `social`, text `copyright`), built from `footer link list` (group=shop | info | social), `footer newsletter` and `footer legal`. The storefront fills it in `apps/storefront/pages/shell.js` → `SiteFooter`.

- Desktop: newsletter and link columns side by side (flex 1 each), copyright left, legal right.
- Mobile (`--mobile`): stacked, links in two columns, legal above the copyright.
- Without `newsletter` the links take the whole row (Figma: boolean off).
- Accessibility: `<footer>` (contentinfo), links in a named `<nav>`, each column a list named by `aria-label`; the newsletter note describes the field (`aria-describedby`) and its Privacy link is underlined (1.4.1); 16px lines 24px apart pass 2.5.8 by spacing; focus = browser ring (no focus token yet).

## API

<!-- api: FooterProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `newsletter` | `ReactNode` |  | Figma boolean `newsletter`: the signup (a FooterNewsletter). Omit → the link columns take the whole row. |
| `children` | `ReactNode` |  | FooterLinks columns (Figma `footer link list` instances: shop, info, social). Rendered in a &lt;nav>. |
| `navLabel` | `string` | `Footer` | Accessible name of the footer &lt;nav>. |
| `legal` | `ReactNode` |  | Legal links (&lt;a> elements), body-small, wrapping. Figma: `footer legal`. |
| `legalLabel` | `string` | `Legal` | Accessible name of the legal links group. |
| `copyright` | `ReactNode` |  | Figma `copyright`, e.g. "© 2026 rythem-trax". |

`*` required.
<!-- /api -->

<!-- api: FooterLinksProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `links` * | `{ href: string; label: ReactNode; rel?: string; target?: string }[]` |  | The links, in order. |
| `label` | `string` |  | Name of the list for screen readers (aria-label: the columns have no title in Figma). |

`*` required.
<!-- /api -->

<!-- api: FooterNewsletterProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `action` * | `string` |  | The form action: the provider's subscribe URL (Buttondown embed-subscribe). |
| `method` | `string` | `post` |  |
| `label` | `ReactNode` | `Newsletter` | Field label. |
| `placeholder` | `string` |  | @default "Your email" |
| `name` | `string` | `email` | Name of the email field sent to the provider. |
| `submitLabel` | `ReactNode` | `Subscribe` | Button text (secondary). |
| `note` | `ReactNode` |  | Figma `note`: what you get and how double opt-in works, ending with the Privacy link (underlined). Describes the field. |

`*` required.
<!-- /api -->
