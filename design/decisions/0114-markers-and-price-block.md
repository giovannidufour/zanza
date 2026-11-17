# 0114 — Create listing: markers, Price as its own block

`2026-11-17` · accepted · Figma: page `listing form` → `marker` (2359:23758), `listing line` boolean `number`; page `Create` → `price fields` (2362:4410, device=desktop | mobile); screens "Create listing - desktop · section nav" and the mobile sticky frame

**Context.** Gio, continuing the restructure ([0113](0113-create-sections-and-fetch-from-label.md)): he wants to draw the eye to some elements of the form, and Price apart from Label.
**Decision.**
- `marker`: a 48 × 48 circle, border 1 border-divider/strong, body/extra-large text/strong, centred; 0 gap to the fields next to it (Gio: wanted). Decorative in code (aria-hidden): the labels carry the meaning.
- `listing line` starts with a marker holding the line number ("1", "2"…): root = marker + body (fields, sample).
- "Label & price" split in two sections: **Label** (Label, Country, Year, Pre-release, spelling, Format) and **Price** (`price fields`: marker "€€" + Sale type + Price; desktop 2 + 2 of 8 columns, mobile stacked). The section nav has Label + Price.
**Rule.** A marker is only an accent: never the only carrier of information, always aria-hidden. Which blocks get one is Gio's call (today: track lines, price).
**Where.** `packages/ui` (Marker, PriceFields, ListingLine `marker`), `apps/admin/admin.js` (FORM_SECTIONS, ListingForm).
Open: the same circle means an order on lines and an emphasis on price; a rule for which blocks get a marker is pending (design/open.md).
