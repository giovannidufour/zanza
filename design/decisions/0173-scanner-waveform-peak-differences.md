# 0173 — Scanner waveform: one tone, thinner bars, peaks squared so their differences show

`2026-11-24` · accepted · Figma: not updated yet (`waveform` 2446:26014, see open.md → Figma to fix)

**Context.** Gio (2026-11-23/24) found the Samples tab waveforms "super compressed" and fat ("ciccione"): every bar was almost the same height. The waveform drew the linear peak of each of 240 bars (about 0.6 s each); in 0.6 s there is nearly always a drum hit at the record's peak, so a dense record is a flat block. A two-layer version (RMS over peak) was tried and rejected: he wants one tone that shows the differences between peaks more.
**Decision.**
- One tone as before (played, unplayed, silence colors unchanged), **480 bars** (about 0.3 s each, so beats and gaps separate) and **thinner bars** (50% of the step instead of 60%).
- Height = **(bar peak / clip peak)²**: relative to the clip's own peak, so every clip uses the full height whatever its recording level, and squared (energy) so small peak differences read: −1 dB ≈ 80% of the height, −3 dB ≈ 50%, −10 dB ≈ 10%.
- Display only: audio and export unchanged (0157 is the export gain). A record whose peaks really are all the same still looks even.
**Rule.** A waveform shown to judge a record's dynamics is scaled to the clip's own peak and squared; linear peak bars only show that a record is loud.
**Where.** The Mac Scanner app (`apps/scanner/Sources/Samples.swift` → `analyse`, `SamplesViews.swift` → `Waveform`). Amends 0141.
