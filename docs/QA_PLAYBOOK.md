# WA-WORLD v0.5.0 — Quality Gates, Minimal Tester Work

## One-click QA

Run `QA-ONE-CLICK.bat` from the project root (Windows), or `npm run qa`.

- Tests execute without WhatsApp, API keys, Baileys pairing or internet connection.
- A JSON report is written to **`data/qa-report.json`**. This is local runtime data, not part of update ZIPs.
- Open dashboard `start-dashboard.bat` at `http://127.0.0.1:3000`: QA section lists **WAJIB**, **OPSIONAL**, **AUTO**, **LIVE**, and result **PASS**, **FAIL**, or **PENDING_LIVE**.
- If any mandatory AUTO fails, **stop before live testing**. If all mandatory AUTO pass, the build is **ready for limited live tests** but not verified end-to-end.

## Minimal LIVE smoke test — three required checks

1. **LIVE_PAIR**: Start `WA-START.bat`, QR/link your dedicated WhatsApp account. Confirm terminal reports connection open. (If already paired, restart and check connection open.) Do not share QR/auth folder.
2. **LIVE_ROUNDTRIP**: From a second consenting WhatsApp account send `.menu` and verify bot replies.
3. **LIVE_BUTTON**: Tap `.menu → Games → Coin → Kepala`; verify reply arrives and `.wallet` can be queried. A losing game may not change balance; a winning game should follow the reward logic (daily cap may prevent credit).

Recommended but **optional**: `.packs → Lucky → Dice`, reconnect after restart, compatibility on WhatsApp Web/iOS, groups disabled by default.

Record your own observed results with `QA-LIVE-RECORD.bat`, entering `P` (pass), `F` (fail), or `S` (skip/pending). This updates `data/qa-live-results.json`, then regenerates QA report.

**IMPORTANT:** LIVE statuses are *operator-reported*, not automatically verified by the bot; existing success of v0.4 cannot be assumed to validate v0.5. No automated script will pair your device, send bulk WhatsApp messages or claim UI buttons rendered remotely.

## Flag policy

| Flag | Meaning | Blocking? |
|---|---|---|
| `WAJIB AUTO` | regression, database safety, game mechanics, button mapping, patch presence | Blocks QA offline gate on failure |
| `WAJIB LIVE` | linking, command round-trip, functional native button | Required for end-to-end approval |
| `OPSIONAL LIVE` | secondary interactive packs, reconnect, extra clients, groups | Not required for limited beta |

QA statuses: `PASS`, `FAIL`, `PENDING_LIVE`.

## Game pack quick commands

- `.menu`, `.games`, `.packs` (native panels), `.pack lucky`, `.pack brain`, `.pack word`.
- New single-turn: `.dice 4`, `.parity genap`, `.highlow naik`.
- Start then answer: `.math start`, `.trivia start`, `.scramble start`, `.pattern start`, `.memory start`, `.cipher start`, `.emoji start`, `.riddle start`, `.hangman start`, `.chain start`.
- `.missions`, `.mission claim play3`, `.mission claim win2`, `.mission claim daily`, `.badges`.

## Security and data retention

Data directories, `.env`, WhatsApp credential folders and local dependency folders are excluded from ZIP source updates. **Back up your `data/` folder separately** before running a patch; source rollback does **not** revert SQLite schema migrations or earned V-Currency. The exporter may not remove passwords hard-coded into source files; review ZIP contents before sharing.

No top-ups, withdrawals or exchange to real money. All 16 playable games are free. Reward cap: 100 V/day from game wins, plus independent daily and mission rewards; real-money payments are not implemented. Sessions persist in SQLite and expire after 15 minutes for challenge games.
