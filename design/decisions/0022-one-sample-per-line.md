# 0022 — One sample per line

`2026-11-10` · accepted · Gio, in chat

**Context.** Each line of the form (side A, B…) had a drop zone that took any number of samples, so a line could hold several clips with the same title.
**Decision.** A line takes one sample: once it has one, its drop zone is hidden (it comes back if the sample is removed); a drop of several files keeps the first and says so. More clips (dub, versions) are added in Samples overview as additional samples. Older listings with more samples on a line keep them.
**Rule.** A slot that holds one thing hides its add control when full, instead of refusing on drop.
**Where.** `apps/admin/admin.js` (line section, `addFiles`).
