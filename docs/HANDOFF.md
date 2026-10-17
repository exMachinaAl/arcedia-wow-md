# WA-WORLD v0.5.0 — session handoff

Session reference `GPT-6A29EB-20261016-B20C6A4DA9` identifies discussion but is not a database password or automatic chat-history lookup.

Vision: WhatsApp-first, 100+ uniquely playable games, self-hosted JSON/AI LLM/ML, free-all with optional queue priority, virtual non-top-up V-Currency, developer access and possible independent mobile app.

## Implemented
- ZIP merge installer, safe diff/rollback; no GitHub.
- Baileys + native-flow interactive buttons and fallback to text commands. User reported buttons and most v0.4 functions working.
- 16 playable games in `src/core.js` + `src/games/expansion.js` and SQLite persisted challenge sessions.
- Wallet ledger, WIB daily 10 V + 5 XP claim, 100 V daily game reward cap, 3 missions, 6 badges, XP/levels and nickname opt-in leaderboard.
- `QA-ONE-CLICK.bat`, `QA-LIVE-RECORD.bat`, `qa/features.json`, local `data/qa-report.json` plus dashboard QA flags.
- 35 automated offline tests, offline gate PASS. Live checks **must remain PENDING_LIVE** until the owner tests actual v0.5 integration.

## Update requirements
- Major patch **v0.4.0 → v0.5.0 only**; back up `data/`; do not place QR/auth in ZIP.
- User performs just three mandatory live checks: WA pairing, `.menu` round trip, `.menu → Games → Coin` native click. Optional: `.packs`, reconnect, iOS/Web, groups.
- To continue in a different chat, upload current project source/export. Session code alone cannot retrieve prior code.

## Next scope
- Deeper user retention/game uniqueness, multiplayer moderation, production robustness and security.
- AI self-hosted LLM and structured JSON API with authorization and rate limits remain future scope. No claim of working AI yet.
