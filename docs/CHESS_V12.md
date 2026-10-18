# WA-WORLD Chess Arena v1.2 — Operator & QA Guide

## Workflow

1. Open WhatsApp private chat with bot on two consented numbers.
2. A `.chess join`, B `.chess join` (pair if rating gap in window). Both `.chess accept` within five minutes.
3. A is White; `.chess board` for PNG; `.chess move e2e4` then B `.chess move e7e5` (UCI notation).
4. `.chess status`, `.chess rating`, `.chess top`, `.chess resign`, `.chess leave`.
5. Games stored in `chess_matches`; moves in `chess_move_log`; ratings in `chess_ratings`, not shared with V-Currency.

## Mechanics

- Opt-in queue, 5-minute queue/accept TTL, 24-hour match inactivity timeout; FIFO with initial ±200 Elo window expanding by 25 per minute.
- Elo starts at 1200; K=24. Short (<8 half-moves) resigns do not update ratings. Rating leaderboard only displays people who opted in to .rank join with nickname.
- Win by checkmate or resignation. Draw check: stalemate, limited insufficient material, 50-move threshold, threefold based on normalized position signature.
- Move notation is source+destination, example `e2e4`, promotion suffix `q/r/b/n` (or queen by default). There is NO chess AI opponent in this release.
- Basic rules are locally implemented. The engine has not been independently certified for every FIDE edge case; don't use for rated official tournaments. In particular advanced dead-position, claim-based draw subtleties, and live reconnection must be hardened.
- No ML predictions are present in v1.2. Ranking-based matching uses a deterministic rule, not trained ML. Subsequent releases can use locally collected, consented performance data.

## Minimum Live QA

`LIVE_PAIR`: bot connects; `LIVE_ROUNDTRIP`: .menu; `LIVE_CHESS`: 2 users pair/accept/move; `LIVE_CHESS_PNG`: generated image visible on recipient phone. Other tests optional. Offline PASS never implies LIVE PASS.

## Security

Only private chat permitted for chess commands; user ID is derived from Baileys sender JID; outsiders cannot fetch another match board by ID. Request IDs are idempotent in core ledger. Do not upload WhatsApp auth/session files. No top-up, no wager.
