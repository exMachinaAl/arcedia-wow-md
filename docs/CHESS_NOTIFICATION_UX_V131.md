# WA-WORLD Chess UX and Notifications v1.3.1

## Player flows
- `.menu` → Games / Arena / Lainnya. `.nav arena` → Catur / Ular Tangga / Beranda.
- `.chess join` → waiting message with queue count and optional exit; `.chess status`, `.chess lobby`, `.chess leave`.
- Match found → both opted-in participants receive private notice; `.chess accept` or `.chess cancel`.
- Both accepted → white receives active board and first-turn alert; black receives waiting board.
- Move → next player's WhatsApp receives board PNG plus instructions. No duplicate actions on repeated message IDs.
- `.chess resign` → opponent gets win alert; valid checkmate/draw creates finished notices for both players.
- Expiry → participants receive expiration notice after notifier scan. No automatic win assigned.

## Architecture
`chess_notifications`: SQLite outbox rows with recipient JID, match ID, reason, message, optional image and delivery flags. Chess engine inserts events in the same transaction as state changes. Poller runs every 8 seconds plus after commands and reconnect. Delivery retries at exponential backoff; max 5 attempts in the current process. Operator must inspect undelivered rows; no dead-letter management UI yet. Notifications are **at least once**, duplicates possible after ambiguous network errors. No bulk messages or unsolicited recipients.

## Limitations / future backlog
- WhatsApp recipient display and actual read state not confirmable from submission alone.
- Native quick-reply shows only three choices per current panel for compatibility; multiple menus expose more options.
- No one-click chess move selection yet; legal moves typed in UCI.
- No reconnect-to-existing-ID normalization for all LID/JID cases yet.
- Read receipts, round reminders, group lobby, accessible high-resolution boards, and dedicated chess UI remain backlog.

## Live QA (required)
Two accounts connected to private bot chat: both join; both see automatic match-found DM; both accept; white and black receive initial board; white plays e2e4; black receives auto board; black resigns; white receives explicit win. Use QA-LIVE-RECORD.bat for result status.
