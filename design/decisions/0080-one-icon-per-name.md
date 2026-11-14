# 0080 — One icon per name: the "-ultra" drawings are the icons

`2026-11-14` · accepted (Gio) · Figma: page `icons`

**Context.** While designing, Gio drew new versions of some icons and saved them next to the old ones with an `-ultra` suffix (`icon-play-ultra`, `pause-ultra`, `play-next-ultra`…). Every screen and component already used the `-ultra` drawings; the originals had no instances. Two names for one icon made it unclear which one was the standard, and some `-ultra` names had no `icon-` prefix.
**Decision.** The `-ultra` drawings replace the originals and take their names; the originals are deleted. Mapping: `icon-play-ultra` → `icon-play`, `icon-heart-ultra` → `icon-heart`, `icon-check-circle-ultra` → `icon-check-circle`, `pause-ultra` → `icon-pause`, `play-next-ultra` → `icon-skip-forward`, `play-previous-ultra` → `icon-skip-back`, `hamburger-menu-ultra` → `icon-bars-two` (names of the old originals, Gio's choice); `icon-plus-ultra`, `icon-x-ultra`, `icon-asterisk-ultra` had no original and become `icon-plus`, `icon-x`, `icon-asterisk`. Component ids did not change, so every instance kept its overrides. The code already drew the `-ultra` shapes (0066); only the Figma names in comments and docs changed.
**Rule.** One icon per name: a new version of an icon replaces the old one (swap instances, delete the old, keep the name), never a suffixed copy. Every icon is named `icon/icon-<name>`.
**Where.** Figma page `icons` · `packages/ui/components.js` (`*Icon` comments).
