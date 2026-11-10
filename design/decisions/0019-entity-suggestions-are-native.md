# 0019 — Artist and label suggestions use the native datalist

`2026-11-10` · accepted (provisional UI) · Figma: none (BACKEND → Create has plain `input` fields)

**Context.** Artists and labels are entities (migration 0006). While typing, the admin must suggest existing ones and bind the field to the chosen entity. No suggestion list / combobox is designed in Figma.
**Decision.** Gio (2026-11-10): the `Input` gets a native `<datalist>` (`list` prop, passed to the control as in 0018). Options: every official name, plus every alias shown as "alias → official". Typing an official name binds while typing; an alias, on leaving the field, becomes the official name with the alias as "As printed". The database binds again on save (id → Discogs id → name or alias → new entity), so the list is a help, not the source of truth.
**Rule.** Until a Figma combobox exists, entity pickers (artist, label, later genre/tag?) are `Input` + `<datalist>`, never a custom dropdown. When the combobox is designed it replaces the datalist in one place (`entityOptions` in `apps/admin/admin.js`).
**Where.** `apps/admin/admin.js` (`entityOptions`, `bindTyped`), `supabase/migrations/20261110040000_artists_labels.sql`.
