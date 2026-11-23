# 0157 — Scanner: every exported sample gets a fixed +8 dB boost (peak ≤ −2 dBFS)

`2026-11-23` · accepted · Figma: none (no UI change)

**Context.** Gio's clips were too quiet: his test rips sat at −20 to −28 LUFS with the sample peak at −10 dBFS on every file (about 10 dB of unused headroom), and the Scanner's earlier exports were the same (−21 to −30 LUFS, peaks −10 to −13 dBFS). He wants them loud but rejected peak normalize (vinyl clicks set the peak) and anything that changes the dynamics on a club system (0141 parked normalization). Measured: the clicks do not set the peak on these files (de-click lowered it by 0.2 dB), and +10 dB of gain made 4 of 10 MP3s clip after encoding (0 / +0.1 dBFS). He listened to +8 dB (peak −2 dBFS, 12–15.5 LUFS for most) and chose it as the rule for every conversion.
**Decision.**
- Every audio file the Scanner writes gets the same plain gain of **+8 dB**: the export's WAV and MP3 320, and the 128 kbps MP3 of Push to admin.
- The gain is **capped so the sample peak stays at −2 dBFS**: a hotter recording gets less than +8 dB instead of clipping. No limiter, no normalize, no compression, no de-click: the dynamics are those of the recording.
- Quiet, very dynamic sides stay quieter than the others (they are not levelled to a LUFS target); in a club the mixer gain does that.
- Values in one place: `AudioExport.boostDB` and `AudioExport.ceilingDB`. The old `normalize` option (always off) is removed.
**Rule.** Make samples louder with plain gain only, the same for every file, and leave 2 dB of headroom for the encoders; never trade transients for loudness.
**Where.** The Mac Scanner app (`apps/scanner/Sources/AudioExport.swift`). Amends 0141 (Export → Volume).
