# WA-WORLD Ultimate v0.5.0 — Game Pack + Offline QA Gates

Offline ZIP major upgrade from **v0.4.0**. No GitHub required.

## What's new

- **16 total playable games**: previous Coin, RPS and Guess plus 13 new games in `src/games/expansion.js`.
- **Persistent puzzle sessions**: math, trivia, scramble, pattern, memory, ROT13 cipher, emoji, riddle, hangman, word chain. All accessible by typed commands; selected packs have native WhatsApp panels.
- **Progress**: 3 daily missions, 6 badges, and per-day mission progress with idempotent reward ledger.
- **Native game pack buttons**: `.packs` -> Lucky / Brain / Word; these rely on the same experimental native-flow mechanism that showed up in user's previous build. Fallback text commands remain available.
- **QA-ONE-CLICK.bat** automatically executes unit tests and writes a local report. 3 mandatory real-WhatsApp checks remain marked `PENDING_LIVE` until you report them. See `docs/QA_PLAYBOOK.md`.

## Update for existing v0.4.0 users (recommended)

1. **Stop** bot, dashboard and simulator. Make a separate copy of `data/` as a safety backup. (The installer preserves `data/`, but does not include it in a backup or rollback.)
2. Extract `WA-WORLD-Update-Kit-v0.5.0.zip` next to the existing `WA-WORLD-Starter` directory.
3. Execute `01-PREVIEW-UPDATE.bat` and check for conflicts. Run `02-INSTALL-UPDATE.bat` and type `YES` if clean.
4. In the project folder, run `QA-ONE-CLICK.bat`. Start dashboard with `start-dashboard.bat`; open `http://127.0.0.1:3000`.
5. Start WhatsApp bot using `WA-START.bat` (npm dependencies if needed); test the **three mandatory live checks** in `docs/QA_PLAYBOOK.md`.
6. Run `QA-LIVE-RECORD.bat` to mark actual device observations P/F/S and update dashboard flags.

If you never installed v0.4.0, **do not run the patch directly**. Use the Full v0.5.0 ZIP in a clean new directory or update sequentially.

## Local commands

```bash
npm test          # 35+ automated tests
npm run qa        # mandatory/optional QA flags, JSON report
npm run qa:live   # interactive recording of YOUR real WA tests
npm run chat      # simulate command gameplay without WA or pairing
npm run bot       # real Baileys gateway
npm run dev       # dashboard and local status API
```

## Command examples

```text
.menu
.games
.packs
.dice 4
.parity genap
.highlow naik
.math start
.math 4
.trivia start
.scramble start
.pattern start
.memory start
.cipher start
.emoji start
.riddle start
.hangman start
.chain start
.missions
.mission claim play3
.badges
.profile
.wallet
```

## Compatibility / honest limits

- **Do not treat passed offline tests as proof of a working WhatsApp connection.** v0.5 live QA is pending. Buttons and Baileys use an unofficial WhatsApp Web integration, subject to protocol changes and account restrictions.
- SQLite uses built-in Node.js >=22.16.0 (experimental Node SQLite API). `npm install` is needed for live gateway dependencies.
- Mission and daily reward accounting is a prototype (not anti-fraud hardened); no production-grade multi-process outbox or monitoring yet.
- AI LLM/ML, self-hosted JSON workers, developer API, tiers, standalone client and the remaining 84 game ideas remain in `docs/PRD_MASTER.md`, `docs/FUNCTION_REGISTER.md`, and `project/tracker.json`.
- Do not share `data/`, session credentials, QR codes, or private JIDs. **Source rollback is not a database rollback.**

Session reference: `GPT-6A29EB-20261016-B20C6A4DA9`.
# arcedia-wow-md
# arcedia-wow-md
