# WOW 2.3 — Adaptive Economy, Seasons & Auction Recovery

## New commands

- `.season` — deterministic 7-day season; `.season progress` or `.season claim` for **15 V** after 3 mining actions or 2 distinct-day expeditions; one award per player and season, with audit journal.
- `.guildshop` — guild supply listing; `.guildshop buy copper` spends **40 V from guild treasury** (owner/officer); `.guildshop buy iron` spends **60 V** and requires Hall Lv2. Only one order/guild/day. `.guildshop claim` lets each guild member receive **one material/day** after a purchase. No direct V transfer is implemented.
- `.auction risk` — private aggregate risk flags if experimental auction is explicitly enabled.

## Recovery

`core.sweepAuctions({now,limit})` must execute inside a SQLite transaction; it is called by the WhatsApp gateway on startup and every 60 seconds. It closes and reconciles previously opened auctions even when the auction feature flag has since been switched OFF. It does not accept new public bids when OFF. Exactly-once settlement comes from the durable auction status and `wow_auction_movements`.

## Anti-collusion

Auction bids between the same seller and buyer are blocked once **two sales have SETTLED in the preceding 7 days**. Flags go to `wow_auction_risk_flags`. Additional barriers from v2.2 (minimum account age, games played, same-guild blocks, capped listings) remain. This is a deterministic policy rule, **not a trained ML classifier**. It is neither a substitute for manual adjudication nor a legal compliance review.

## Important limitations

Auctions remain DISABLED by default (`WOW_AUCTION_ENABLED` unset). Historic escrow is reconciled on next gateway startup, but a process that is never restarted and never receives a timer tick cannot work while powered off; no external server worker is provided. Bot gateway uses unofficial Baileys and native WhatsApp button rendering still requires real-device verification. No money, fiat on- or off-ramp, cashout, or direct transfer. Feature suitability for public WhatsApp remains unverified.

## Offline QA

`node --experimental-sqlite --test tests/*.test.js` and `npm run qa`. 14 new automated tests, 301 total passing in reference Linux Node 22.16 environment. Must run basic `.season progress`, `.guildshop`, `.dailyshop`, `.stats world` smoke tests after installation. Do not claim WhatsApp LIVE PASS until user confirms.
