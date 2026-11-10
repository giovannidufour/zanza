# 0029 — A count next to a label is the component's suffix

`2026-11-10` · accepted (Gio) · Figma: `tab` (`suffix` of `_tab-sizes`), `filter` (`count`)

**Context.** The admin tabs wrote the count inside the label text ("All 48", "Artists 64").
**Decision.** Gio: a number next to a label is "a perfect example" for the component's suffix property. Tabs: label "Artists" + `suffix` "64" (same text style, gap 4). Filters: label + `count` (body/small, text/moderate).
**Rule.** Never concatenate a count into a label: use the component's suffix / count property, in Figma and in code (`Tab` `suffix`, `Filter` `count`). A component that needs a count and has no suffix gets one.
**Where.** Figma Listings and Attributes pages (44 tabs moved to `suffix`); `packages/ui` `Tab` `suffix`, `Filter` `count`.
