# WOW Economy v1.7 — World of WA

**Status: implementation beta, no production/legal clearance.**

## Core principle
- Main V-Currency is virtual and has no deposit, top-up, cash-out or redemption; only positive guaranteed rewards (.daily, .mine, .work) and fictional paper-style market positions. Existing legacy transfers remain possible only if mutually enabled; they may need disabling before public launch.
- Arcade V is bound to each account and may ONLY purchase deterministic cosmetics. It is awarded by free Gacha (+2 V), Symbol Match, and Risk Rooms. Daily cap 40 bound V, no paid attempts, bets or purchasing odds. The two balances MUST NOT be merged into one transferable balance.
- Virtual assets NOVA/AQUA/ORBI use public deterministic synthetic prices, not real securities. Buying/selling changes *main V*; prices may move. Max 10 shares/trade, max 50 shares/asset, max 250 V daily purchases. Fixed quotes are computed per Jakarta calendar date; no external investment API.
- ML is NOT used to control RNG, odds, market quotes or gameplay outcome. `.market outlook` is an explicit heuristic, NOT a trained prediction model.
- All operations are atomic with SQLite and processed-message idempotency. Backup `data/` before upgrading, rollback of source cannot undo economy DB transactions.

## Commands
`.wow`, `.wow starter`, `.wow wallet`, `.mine`, `.mine status`, `.work complete`, `.market`, `.market buy NOVA 1`, `.market sell NOVA 1`, `.market portfolio`, `.market outlook`, `.wow shop`, `.wow buy arcade-title`, `.wow collection`.

## Next milestones
- ML recommendation trained only on opt-in telemetry, no odds manipulation.
- Ranked/Casual split in Chess/Blackjack/Snakes with *non-staked* capped achievement awards, no winner-takes-loser wallet transfer.
- Anti-bot farming/anomaly monitoring, wealth and asset inflation indicators, deterministic item sinks.
- Legal/platform review before exposing virtual currency and chance-game features publicly.
