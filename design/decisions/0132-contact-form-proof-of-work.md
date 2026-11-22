# 0132 — Contact form: invisible proof of work against bots

`2026-11-22` · accepted (Gio: "il più smooth ma efficace, in modo da non ricevere bot") · Figma: none (no visible UI)

**Context.** The `/contact/` form already had a honeypot (`website`) and an origin check. Gio wants something stronger but smooth. Cloudflare Turnstile is the strongest free option, but Cloudflare sets its own "strictly necessary" bot cookies, it needs a widget + secret, and Privacy would name one more processing; Gio's rule is no cookies and a minimal Privacy (0130, 0131).
**Decision.**
- **Own proof of work, ALTCHA-style, no library, no third party.** `GET` on the `contact` function returns a signed puzzle `{ salt, challenge, max, signature }` with `challenge = sha256(salt + n)`, `n < max` (50 000). `scripts/site.js` asks for it as the page opens and solves it in the background (WebCrypto, batches of 500); the answer travels with the `POST` as `pow`.
- **Stateless check**: signature = HMAC with a key derived from `SUPABASE_SERVICE_ROLE_KEY` (always set in Edge Functions; `POW_SECRET` overrides it). Valid for 1 hour. Nothing stored, no cookies, no device storage, no extra data processed: Privacy unchanged.
- **Time trap**: a message sent less than 3 s after the puzzle was issued gets a fake "ok" and is dropped, like the honeypot. A missing or wrong answer gets a 403 and the form's usual error line.
- **Invisible**: no widget, no checkbox, no change to the form.
- Limit: a bot that runs JavaScript can solve it; the cost per message is what stops mass spam. If spam still arrives, the next step is Turnstile (accepting Cloudflare's cookies) or a per-IP rate limit in the function.
**Rule.** A public form that sends email or writes data gets the honeypot + the puzzle (`solvePuzzle(endpoint)` in `site.js`, `newPuzzle`/`checkPuzzle` in the function). Never a visible captcha without a Figma frame and Gio's ok.
**Where.** `supabase/functions/contact/index.ts`, `apps/storefront/scripts/site.js` (`solvePuzzle`, `initContact`).
