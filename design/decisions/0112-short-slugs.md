# 0112 — Slugs at most 80 characters

`2026-11-17` · accepted · Figma: none (no UI)

**Context.** A compilation LP (Urban Dub) got a slug of 300+ characters: the display name joins every track's artist and title. Every shop build then failed (`ENAMETOOLONG` creating `dist/products/<slug>/`), so nothing reached the shop from ~21:50 Rome time on 2026-11-17.
**Decision.** `public.slugify` keeps at most 80 characters, cut at the last word boundary (a single longer word is cut at 80). Migration 0027 (`20261117030000_short_slugs.sql`) redefines it and shortens existing long slugs in listings, artists, labels, genres and tags ("-2", "-3"… when taken).
**Rule.** A URL slug is short and readable, never the whole name: 80 characters at most, cut at a word.
**Where.** `supabase/migrations/20261117030000_short_slugs.sql`.
