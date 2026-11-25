# 0184 — The Mac app is ZANZA, the platform's tool, not a HIGHMUZIK Scanner

`2026-11-25` · accepted (Gio: "L'app mac ora non è più solo uno scanner. E mi piacerebbe tenere ZANZA per quella") · amends 0182 for `apps/scanner`

**Context.** 0182 renamed the store to HIGHMUZIK, internal ids included, and PR #257 renamed the Mac app "HIGHMUZIK Scanner" (`com.highmuzik.scanner`). The app now does far more than scanning (drafts, samples, clip videos, Push all), and Gio keeps "zanza" as the platform name: HIGHMUZIK is a store that runs on Zanza (repo, Figma file and claude.ai project stay "zanza").
**Decision.** The Mac app is **ZANZA** (`ZANZA.app`, window title ZANZA, executable `Zanza`). Its internal ids go back to the pre-0182 ones so nothing on the Mac needs migrating: bundle id and Keychain service `xyz.gio-d.zanza.scanner` (preferences, saved folders and the admin login stay), Info keys `ZanzaSupabaseURL` / `ZanzaSupabaseKey` / `ZanzaMediaBaseURL`, Application Support `Zanza Scanner/Session`, default folders `Zanza samples`, `Zanza scans`, `Zanza videos`. The source folder stays `apps/scanner`.
**Rule.** Platform tools (Mac app, repo, Figma file, project) are named ZANZA; everything a customer sees, and the store's own config, is HIGHMUZIK. Don't rename the Mac app's bundle id again: it would drop its preferences and Keychain login.
**Where.** `apps/scanner/Info.plist`, `build.sh`, `README.md`, `Sources/*.swift`.
