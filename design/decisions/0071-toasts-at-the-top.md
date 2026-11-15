# 0071 — Toasts sit at the top, below the sticky header

`2026-11-13` · accepted (Gio) · amends [0049](0049-toast-feedback.md) (*Where*) · supersedes [0055](0055-toast-mobile-gap-16.md) · Figma: page `toast` → "toast — placement desktop" (2177:629), "placement mobile" (2177:703), "placement mobile, header hidden" (2183:387)

**Context.** 0049 put the toast at the bottom of the viewport, above the player. Gio wants it at the top: top-right on desktop, top on mobile. The top is where the sticky header lives (0010): it scrolls away on scroll down and slides back on scroll up, so a toast pinned at the top edge would cover the header (and its Bag count, which Add to bag also updates).
**Decision.** The toast region sits `gutter/small` below the **visible part of the header** (`--site-header-visible`, the value the PLP filters already follow): it moves 1:1 with the header on scroll down and follows its 200 ms reveal on scroll up. With the header gone it sits `gutter/small` from the top, or below the safe area (notch) if that is larger (`max()`, not a sum, as 0055). Desktop: right-aligned at the page margin, 360 wide. Mobile: full width minus the page margins. The player no longer moves the toast. Enter: fade + 8px drop from above (was a rise). The admin has no sticky header: `gutter/small` from the top.
Claude's choice, flagged: **below** the header, not over it (over it would hide the Bag count right when Add to bag changes it).
**Rule.** A floating layer at the top of the shop keeps clear of the visible header via `--site-header-visible`; never a fixed header height.
**Where.** `packages/ui/components.css` (`.zz-toast-region`, `--zz-toast-offset`, `zz-toast-in`), `apps/storefront/base.css` (`.site-toasts`), `packages/ui/tokens.json` (`gutter-small` usage).
