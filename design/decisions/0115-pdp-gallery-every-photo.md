# 0115 — PDP gallery: every photo, never repeated

`2026-11-17` · accepted · Figma: page `PDP` → `product image` ×2 / `mobile gallery` (unchanged: two images drawn, the list is open-ended)

**Context.** The PDP gallery showed two images (cover + first copy photo) and the admin preview cut at 2, while a listing can hold any number of photos. With one photo, the data layer reused it as the copy photo, so the PDP showed it twice. Gio: no cap, and drop the repeat rule for good.
**Decision.** PDP gallery = every photo of the listing in its order (cover first); the admin Create preview the same. Desktop keeps scrolling inside the gallery (0033, 0036), mobile keeps swiping (0011). One photo = one image: `copy.photos` is the photos after the cover, empty when there is one (data/products.js), and the JSON test content no longer repeats the cover.
**Rule.** Never cap the gallery and never fill it by repeating a photo: show exactly the photos the listing has.
