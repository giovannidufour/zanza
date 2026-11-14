# 0078 — Unavailable records in the bag: SOLD OUT / RESERVED in a red box, name plain (no strikethrough)

`2026-11-14` · accepted (Gio: "riportameli neri, non crossati, però fammi un riquadro rosso attorno alle informazioni, alla scritta sold out ... o reserved") · Figma: page Bag → `alert` is now a set, `layout` = block | inline; `bag item` status=sold | reserved → `price row` → exposed `alert` layout=inline `status label`

**Context.** Sold and reserved lines struck the record name through (0064, 0065). A first try the same day (PR #91) coloured the name and the word red (`text/unavailable` → primitive `red-dark`): Gio found it not visible enough.
**Decision.**
- The record name goes back to `text/strong`, **not** struck through.
- "SOLD OUT" / "RESERVED" sits in the same red box as the bag's alerts (0077): `alert` gets a variant `layout` = block (the existing one: padding small, fills) | inline (padding 2/4 as Tag extra-small, hugs). Same tokens (`surface/alert` + `text/strong-invert`, 4.8:1) and body/small.
- The price stays black and struck through beside the box: it is the amount you are not charged.
- `text/unavailable` and `red-dark` (from PR #91) are removed from Figma and code: nothing uses them.
- Colour is not the only cue (WCAG 1.4.1): the box holds the word; the screen reader text ", not in your order," is unchanged.
**Rule.** A status that takes an item out of the order is a word in an inline `alert` next to its price; the item's name stays plain.
**Supersedes.** The "name struck through" part of 0064 / 0065 (bag only).
