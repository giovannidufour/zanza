# 0192 — The shop's samples play at one level (loudness target + light limiter), originals untouched

`2026-11-25` · accepted (Gio 2026-11-26) · Figma: none (no UI change)

**Context.** Gio finds the shop's samples quieter than other record shops (e.g. reggaefever.ch). Measured on his 8 test rips with the Scanner's chain of 0157 (+8 dB, peak −2 dBFS): the 128 kbps copies sit at −13 to −19 LUFS. Their peak is set by the music, not by clicks (0.03–0.5 % of the samples are within 3 dB of it), so plain gain has only ~1 dB left before the encoder clips: getting louder needs a limiter. Gio wants only the shop's copies louder; the WAV and MP3 320 he DJs with stay as 0157 makes them.
**Decision.**
- Only the 128 kbps sample the shop plays is changed: every admin sample upload and clip (0108, 0110) and the Scanner's Push to admin (0142).
- Its integrated loudness (EBU R128) is brought to **−11 LUFS** with one gain, then a look-ahead peak limiter (5 ms attack, 100 ms release) keeps the sample peak at **−2 dBFS** (the headroom of 0157; ≤ −1 dBTP after the MP3 encode).
- The limiter takes off at most **6 dB** on the loudest transient: a very dynamic side gets less gain and stays a bit quieter instead of being squashed.
- A target, not a fixed boost: every sample plays at about the same level (Play all has no jumps), and a file that already has the Scanner's +8 dB is not raised twice. A file within 1 LU of the target is left as it is (a 128 already at level is not encoded again).
- One script for both hosts: `packages/audio/web-level.js`, run by the admin in the browser and by the Scanner in JavaScriptCore (copied into the app's Resources).
- The Scanner's WAV and MP3 320 exports and the videos keep the plain +8 dB of 0157: no limiter on anything Gio keeps.
**Reference** (2026-11-25/26). reggaefever.ch, 10 samples of used 7" (Collector's Items): −10.9 to −20.1 LUFS (median ≈ −15), all peak-normalized to 0 dBFS. The shop's 64 live samples: 40 uploaded before 0157 never got the +8 dB (−20 to −29 LUFS, peak −10), the other 24 sit at −13 to −21 (median ≈ −16). So −11 = as loud as reggaefever's loudest, the same for every record.
**Measured** (8 test rips → 128 kbps): −11.5 to −12.0 LUFS for 7 of 8, −13.6 for the most dynamic (limiter cap), true peak −1.1 to −2.1 dBTP.
**Backfill.** Admin → Settings → **Level samples** (once): reads every sample back from storage, levels it, uploads it under a new key, points the samples rows to it and trashes the old file (purge-media, 7 days, only if unused); samples already at level are skipped; one shop rebuild at the end. Re-encoding a 128 loses a little quality; re-pushing from the Scanner session is the better source where it still exists.
**Rule.** Loudness for listening on the shop is made on the shop's copy only, by the shared script, to a loudness target with a capped limiter; never on the files Gio keeps.
**Where.** `packages/audio/web-level.js` (TARGET_LUFS, CEILING_DB, MAX_REDUCTION_DB), `apps/admin/admin.js` (levelForWeb, toSampleMp3, clipSample, Settings → LevelSamples), `apps/admin/build.js` + `index.html`, `apps/scanner/Sources/WebLevel.swift`, `AudioExport.mp3(web:)`, `AppModel` (Push to admin), `apps/scanner/build.sh`. Amends 0157 (Push to admin's 128 no longer gets the plain boost) and 0108 (a 128 upload is re-encoded when it is not at level).
