## v0.4.0 — WhatsApp Interactive Game Hub (2026-10-17)

- [feature] Real native quick-reply panels for Home, Games, Coin choices, RPS choices and Profile; static allowlisted button IDs and text fallback.
- [feature] Daily claim +10 V/5 XP, WIB calendar reset and daily streak stored in SQLite.
- [feature] XP, level, play/win counters, nickname and voluntary leaderboard (no public WA JIDs).
- [feature] Max 100 V/day on new game reward credits, no topup/cashout; transactional ledger remains idempotent.
- [feature] Dashboard includes daily claims, participating ranked accounts and XP counters.
- [test] 24 automated offline tests, including time boundaries, opt-in privacy, and mocked interactive menu flow.
- [compatibility] 0.3.1 ZIP merge updater maintains data/session; new SQLite tables created lazily (rollback of source does not remove new DB events).
- [evidence] User confirmed native buttons render in v0.3.1. New v0.4 menus not yet verified on their WhatsApp client.

## v0.3.1 — WhatsApp Native Button Relay Fix (2026-10-17)

- [fix] Native quick reply messages now use direct `interactiveMessage` without `viewOnce` envelope.
- [fix] Inject `biz > interactive > native_flow` and private `bot` binary relay nodes for compatible recipients.
- [fix] Stop sending a separate fake menu before interactive messages; fallback commands are embedded in the native message body, or sent separately when relay fails.
- [fix] Telemetry distinguishes an accepted relay from real button rendering, with device feedback by mode.
- [test] Added fake-socket integration tests for native binary nodes, non-view-once payload, errors, fallback and feedback.
- [limit] Actual WhatsApp Android/iOS/Web visual rendering remains unverified until receiver-side test.

# Changelog

## 0.3.0 — Baileys gateway and interactive button test lab (2026-10-17)
- Add modular WA event handler, QR/reconnect integration, stable command-only access.
- Add text fallback, experimental legacy buttons, experimental native-flow buttons, reply parsing, and user feedback.
- Add sanitized WA connection state and button diagnostics in local API.
- Add offline unit tests and Windows launch files. Live WhatsApp pairing/rendering pending.
- Preserve existing offline patch merge workflow with signed-hash checks (hashes do NOT authenticate publisher).

# WA-WORLD — Changelog

## 0.2.0 — 2026-10-17 (Offline merge updates)
- Built ZIP-based offline updater with SHA256 payload checks, baseline version enforcement, path validation, protected directories, conflict handling, backups and rollback.
- Added special tracker merge preserving local task statuses while appending future tasks.
- Added Windows click-to-preview, click-to-install and click-to-rollback scripts and reusable update ZIP protocol.
- Dashboard displays individual task progress and locally applied update history (does not auto-refresh live).
- New patch toolkit can update v0.1.0 to v0.2.0 without deleting database or WhatsApp sessions.
- Added one-click project source ZIP exporter, skipping known secrets and user database files, for future ChatGPT handoffs without GitHub.
- **Not yet Windows-user verified**; no WhatsApp account live tested; no AI or production deployment.

## 0.1.0 — 2026-10-17 (Starter generated)
- Wrote Master PRD v0.1, feature register, 100-game candidate catalog.
- Implemented Node.js local dashboard, structured `/api/status`, offline chat simulator, command router.
- Implemented prototype SQLite user/wallet/ledger with unique event keys and three playable game mechanics.
- Included opt-in Baileys gateway example (not yet live connected or account tested).
- Verified six unit tests under Node 22; live WhatsApp, production deployment, AI and client app not implemented.

Next milestone: complete local verification, then test Baileys with separate test account.

## v0.5.0 — Major Game Pack + QA Flags (2026-10-17)

- 13 additional distinct game modules (16 playable total): dice, parity, high-low, math, trivia, scramble, pattern, memory, ROT13 cipher, emoji, riddle, hangman, word chain.
- Added per-player SQLite `challenge_sessions` with 15-minute expiry and transactional reward handling.
- Added daily mission play/win progress, once-per-day claim for 3 rewards, and 6 rule-based badges.
- Added native button Game Packs without changing legacy Home/Games/Coin/RPS/Profile buttons.
- Added offline one-click QA runner and user-reported live checklist with WAJIB/OPSIONAL status flags and JSON dashboard.
- Existing v0.4 game, wallet, opt-in ranking and Baileys button tests kept; live v0.5 device validation is pending.
- Source-only offline ZIP update from v0.4, backup and rollback; no GitHub required.
