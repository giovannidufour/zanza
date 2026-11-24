# 0177 — Scanner: a square video per clip (label of its side + the clip), for Instagram feed and Reels

`2026-11-24` · accepted · Figma: BACKEND → `Scanner`: section `videos · components` (`record video` + notes), `clip slot` (state filled: `outputs` row WAV + Video), `export panel` (`videos to`)

**Context.** Gio (2026-11-23) wants videos of the records for Instagram (feed, Reels) and YouTube: the sample with its label. First asked for the whole-record scan in 1:1 and 9:16, then changed his mind: always square, with the label crop. Chose a still image over a spinning record (decision card).
**Decision.**
- **Where:** the Scanner app, Samples tab: the clips, their trim and boost (0157) and the label scans are all there. Rendered on the Mac by AVFoundation; nothing is uploaded.
- **What:** one video per assigned clip with **Video** ticked (per clip, off by default, next to WAV). 1080 × 1080, H.264 30 fps + AAC (320 kbps stereo, 160 mono, ≤ 48 kHz). Image = the label crop of that side (Label A for side A, Label B for side B; the same file as the ID3 cover), still, full frame. Audio = the clip with the same trim and +8 dB of the MP3. No text on the video: captions go in the post.
- **One format for all:** square for the feed and for Reels (Instagram shows a square Reel with bands at full screen). No 9:16, no 16:9.
- **File:** `<name>.mp4` (the slot name, 0136) in the "Videos to" folder (default Movies/Zanza videos). Automatic like MP3 and WAV (0144): rewritten when trim, assignment, tags or the label scan of that side change; unticking or unassigning moves it to the Trash with Undo (0149).
- **No label scan of that side, no video:** the clip stays orange ("A1 needs the Label A scan (MP3 cover and video)"); scanning the label writes it.
**Rule.** A derived file (MP3, WAV, video) follows its inputs by itself; a video never goes out without the label of its own side.
**Where.** `apps/scanner/Sources/VideoExport.swift` (render), `AppModel.swift` (plan/sync, `videoFolder`), `Samples.swift` (`Assignment.video`), `SamplesViews.swift` (Video tick, Videos to); Figma Scanner page.
