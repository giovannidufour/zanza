# 0194 — Admin record videos: one frame a second, audio placed by hand (works on iPhone)

`2026-11-26` · accepted · Figma: no change (same buttons and progress)

**Context.** On iPhone (Safari) the videos of 0180 / 0191 came out silent, then, once the audio was fixed (PR #272), very slow. Gio: "can't you make it faster?", and ideally in the background, even with the browser closed.
**Decision.**
- **Audio:** every AAC-LC frame (1024 samples) is placed by us at its own time with `addAudioChunkRaw`; ADTS headers are stripped; an error in an encoder callback stops the export; no audio frames = error, never a silent file. Safari's chunks (no duration, shifted time) were dropped silently by mp4-muxer before.
- **Picture:** the image is still, so the video has **one frame a second** (each lasting until the next, on the 1/30 s grid of the file) plus one keyframe exactly on the A+B cut, instead of 30 identical frames a second: about 30× fewer frames to encode. The photo is read from its canvas once; every frame is a copy of it. Encoder rate control set for 1 fps, so each frame gets the full 4 Mbit/s budget.
- **Background (browser closed):** next step, server-side rendering (ffmpeg on GitHub Actions → R2 → admin), Gio chose "both" on 2026-11-26.
**Rule.** For a still picture, encode only the frames that change; never trust an encoder's timing on a platform we did not test, place the frames ourselves.
**Where.** `apps/admin/admin.js` (makeVideo). Updates 0180 ("H.264 30 fps" → 1 frame/s on a 30 fps timebase).
