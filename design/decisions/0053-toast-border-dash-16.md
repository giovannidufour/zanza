# 0053 — The toast border is dashed [16,16], like the drop zone

`2026-11-10` · accepted (Gio) · supersedes [0051](0051-toast-dashed-border.md) · Figma: `toast` (2177:439) stroke dashPattern [16,16]

**Context.** The dotted [1,1] border of 0051 read too thin once built.
**Decision.** The toast border is `border-divider-strong`, 1px, dashed [16,16]: 16 dash, 16 gap, the same pattern and CSS as the drop zone.
**Rule.** [16,16] is the dash of containers that are not controls (drop zone, toast); [4,4] and [2,2] stay reserved for hover and pressed of outlined controls (0005). A new dashed element reuses [16,16] only if it is not a control, otherwise it gets a pattern of its own.
**Where.** `packages/ui/components.css` (`.zz-toast`).
