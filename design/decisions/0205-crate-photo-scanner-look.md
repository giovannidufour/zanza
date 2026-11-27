# 0205 — Take photo / Create bargain: the Scanner look (colour, contrast, sharpness per camera)

`2026-11-27` · proposed · completes 0200 (step 4 of the pipeline) and closes open (2) of 0204 · Figma: no UI change

**Context.** Gio, after the first Phone camera records: "too contrasty, too bright, the Scanner has a different effect, the black looks too black". Measured on 8 records shot under one indoor light, phone vs the same label on the Scanner, crops aligned to the pixel: paper L 98 vs 92 with a yellow-green cast, about 15–20 % more saturated, sharper (phone's own sharpening). Median ΔE76 to the scan 10–16.
**Decision.**
- After the crop and the paper evening-out, every photo gets the **Scanner look of the camera that took it**: `phone` (Open camera, From library) or `live` (the page's camera). Each output channel = a cubic of each input channel (`[r, g, b, r², g², b², r³, g³, b³, 1]`), fitted per camera on phone/Scanner pairs (label + vinyl, hole left out). Applied as 9 lookup tables, fast on the phone.
- Why cubic and not a plain matrix: the matrix greyed the Penthouse yellows (ΔE 14 on records left out of the fit); the cubic bends the tone curve (paper to the Scanner's grey-white, black lifted to its dark grey) and keeps saturated inks. Records left out of the fit: phone median ΔE 3.6 (worst 5.7), live 2.7.
- The `phone` fit uses photos as they come out of the camera (not admin downloads, which had been re-encoded).
- **Softening** (`phone` only): Gaussian of 0.096 × (1 − 7.4 / photo px per mm) mm: none for a photo of ~7 px/mm (already as soft as a scan), 0.048 mm at ~15 px/mm (12 MP). Fitted on two resolutions only.
- Label and Full get the same look. Before/after: `/mnt/project-files/crate-camera/colour-fix-v2-2026-11-27.jpg`.
**Rule.** A crate photo is always corrected with the look of the camera that took it; a new camera source gets its own fit from at least 8 phone/Scanner pairs, checked on records left out of the fit, never a hand-tuned curve.
**Open.** (1) All pairs were shot under one indoor light: the paper evening-out adapts brightness, not the colour of the light; daylight pairs needed to validate · (2) the sheet's grey patches are not used yet (would give a per-photo white balance) · (3) softening checked only at 7 and 15 px/mm.
**Where.** `packages/crate-photo/crate-photo.js` (`LOOK`, `scannerLook`, `blur`, `render(…, camera)`), `apps/admin/admin.js` (each shot keeps its `camera`).
