# WA-WORLD v0.4 — Interactive Hub Acceptance Test

Use a test number you control. Report **observed receiver-side display**, not relay status.

1. Stop old bot processes, run `npm test` (expect 24 passing).
2. Run `WA-START.bat` and from a second consenting WhatsApp account send `.menu`. Confirm Games/Daily/Profile appear as tappable native buttons, not plain text.
3. Tap Games; verify Coin/Suit/Tebak Angka buttons. Tap Coin -> Kepala; confirm result and wallet is updated when win is eligible.
4. Tap Suit, then Batu/Gunting/Kertas; verify result. Tap Tebak Angka; input `.guess 1` etc.
5. Tap Daily twice: first awards 10 V and 5 XP, second must say already claimed. Only once per calendar day in Asia/Jakarta (WIB).
6. `.profile` shows XP/level. `.nick MyName123`, `.rank join`, `.rank`; confirm only nickname is public. `.rank leave`; confirm name disappears.
7. Check dashboard `http://127.0.0.1:3000` and `data/world.sqlite` retained after restart. Never share WA QR/auth files.
8. If any button is missing, use the textual command in the same message. Screenshot WhatsApp rendering (crop/blur phone and private info).

Limits: WhatsApp native button feature is unofficial via Baileys. Real-device v0.4 validation pending. Ledger preserves existing balances; old v0.3 earned currency is not retroactively counted in new cap.
