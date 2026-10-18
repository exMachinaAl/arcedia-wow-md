# WOW 2.4.1 — Admin Server Settings / Control Center

Server settings are enforced by `src/admin-settings.js` and persisted in SQLite (`wow_server_settings`). The user **must be authorized by a trusted WhatsApp sender ID**, not by a claimed name or group flag.

## First-time setup (one-time local action)

1. In a **private WhatsApp chat** with your bot, send `.whoami` and copy the exact JID (`...@s.whatsapp.net` or `...@lid`).
2. On the server PC, open the WA-WORLD-Starter folder and double-click **`SETUP-WOW-ADMIN.bat`**. Paste the JID, press Enter. This safely backs up an existing `.env` and adds/updates `WOW_ADMIN_IDS` without replacing other settings. If you prefer manual config: add `WOW_ADMIN_IDS=628xxxx@s.whatsapp.net` to the existing `.env`. For multiple admin JIDs, separate with commas.
3. Restart the WhatsApp gateway with `WA-START.bat`. The admin allowlist is loaded from `.env` on startup. **Do not share your `.env`**. Never set an admin password via WhatsApp.
4. In a private WhatsApp chat: `.admin show` → `.admin grant me 500` → `.wallet`.

> The bot ID from `.whoami` must match exactly; a phone number without suffix, nickname, or group admin status will not work. `SETUP-WOW-ADMIN.bat` must be run with filesystem permission on the project, not via a user chat. Do not put `WOW_ADMIN_IDS` in a publicly served dashboard configuration.

## Commands (admin, private WhatsApp DM only)

| Command | Meaning |
| --- | --- |
| `.admin show` / `.server show` | Full controls, current values, and fixed safety limits |
| `.admin set auction on` / `off` | Open or close experimental Auction House **for new bids/listings**. Existing escrow closes on its original schedule. **OFF initially** |
| `.admin set transfer on` / `off` | Enable controlled `.transfer` among qualified users only. **OFF initially** |
| `.admin set arcade_spend_limit 25` | Main-V Arcade spend per user per day (0–500 V), 0 disables new stake actions |
| `.admin set arcade_win_limit 100` | Main-V Arcade winnings per user per day (0–1000 V) |
| `.admin set dailyshop_limit 3` | Daily Shop units per player per WIB day (0–10), 0 closes purchases |
| `.admin set transfer_max 50` | Max V per peer transfer (1–250 V) |
| `.admin set transfer_daily_limit 100` | Max outgoing V in rolling 24h (1–1000 V); also max 3 transfers/day |
| `.admin set admin_grant_limit 10000` | Max V created per one admin grant (1–50000 V) |
| `.admin grant me 500` | Issue **simulated** V to your admin wallet for testing, with audit entry |
| `.admin grant NICK 100` | Issue V to an existing user's nickname (not a real-world payment) |
| `.admin audit` | Last 12 setting/grant changes |
| `.whoami` | Displays the actual sender JID, **private chat only** |

Admin grant: one event/message only once (idempotent), max 50,000 V issued **per admin in a Jakarta day** regardless of per-command limit. There is no money service, top-up gateway or cash-out. Issuance is logged separately in `wow_admin_grants` and `wow_admin_audit`.

## Peer V transfer controlled mode

Default `OFF`; legacy `.pay` still blocked and legacy `transfers` SQL table still write-protected. Admin enables `.admin set transfer on` once. Then qualified players use `.transfer NICK AMOUNT` from private WhatsApp chats. Both accounts must be at least 72 hours old and have played at least 10 games. Sender can transfer at most 3 times and the configured `transfer_daily_limit` within rolling 24 hours. Only one transfer per pair per hour. Sender cannot transfer to themselves or a member of their guild. Transfer debit, credit and journal occur in one SQLite transaction. No cash-in, no redemption, no conversion to money. Admin can switch OFF immediately; existing transfers remain in history.

## Additional restrictions: still fixed in this patch

* Slot/Risk V cost: 5 V per action; caps are controlled by `arcade_spend_limit` and `arcade_win_limit`.
* **Free** Arcade and unrelated legacy game caps are unchanged. Shop rotates every WIB calendar day, and the global shop stock and prices remain system-generated.
* Auction requirements: seller/buyer account age >=72h and at least 10 games; max 2 open seller listings, 3 listings per 24h, material only, no self-bid or same-guild bid, fixed 5% settlement fee. Escrow persists through restart and finishes after server resumes.
* No V real-money purchase, no conversion, cash-out, withdrawal, or monetary value. Real-money trading off-platform is prohibited. Preventing all outside-market abuse is not guaranteed, so pilot Auction/Transfer in a controlled group, and monitor logs.
* Source rollback does **not** revert DB settings, player purchases, V grants or transfers. Backup the entire `data/` folder with bot and dashboard stopped before installation.

## Existing v2.4.0 (before this patch)

With the old v2.4.0, the only Auction enable mechanism was adding `WOW_AUCTION_ENABLED=1` to the private `.env` and restarting the gateway. There was **no admin chat panel**, and direct peer transfer was blocked. This patch replaces the auction env flag with persisted admin settings, default OFF, managed via `.admin set auction on`. The bootstrap admin JID is always configured locally.
