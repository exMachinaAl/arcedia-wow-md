## v3.4.0 — Interactive WOW Hubs & Account-Bound Chat Signatures
- New five real DM action hubs, using proven 3 quick replies + expandable multi-option selector.
- Home DM menu routes to Games/World/Economy/Identity/Arena panels; button IDs remain server allowlisted.
- Chat signatures are optional V-Currency sinks: Spark, Royal, Guild. Purchases atomic, account bound, logged; no top-up/cash-out/transfer.
- Signature header appears on opted-in chat identity group messages, default EXPLORER still works without it.
- Replace/Delete common-player live remains FAIL/PENDING; no automatic force-delete or permission bypass.

## v3.3.0 — Private Interactive Gameplay & Common-player Revoke Audit
- DM menu uses proven 3 quick-reply + expandable selector, up to 12 private feature choices.
- Blackjack lobby and running games use Hit / Stand / Cards selectors; hand PNG is refreshed after actions.
- Blackjack start-notification outbox can send private card PNG and action panel, without leaking cards to groups.
- New `.buttons mixed` and `.buttons selector` private diagnostic variants.
- Revoke keeps the incoming common-player message key verbatim; no fabricated participant. Revoke remains gated by delivery ACK, admin and opt-in; common-player deletion remains UNVERIFIED/FAILED LIVE in earlier version.
- Queued decoration falls back safely when Replace consent changes instead of suppressing player chat.
- Every new selection is allowlisted; rollback, merge-tracker and user-data protection preserved.

## v3.2.4 — Group Selector Routing & Delete Diagnostics
- Group selector now dispatches the **selected command**, returning distinct Games, Arena, More and World menus instead of repeating the root menu.
- Public group data commands show actual outputs; Daily Shop, Inventory and Arcade selections direct to private DM without triggering another menu.
- `message-receipt.update` delivery evidence is observed for group bot messages; unrelated messages and server-only acknowledgements do not authorize delete.
- `.wowchat diagnose` shows revoke failure reasons and whether the **bot account** is a verified group admin.
- Safe Replace remains fail-closed: if proof is missing, original chat stays. Actual deletion is still PENDING LIVE.
- Existing mixed-button shape (3 quick replies + selector) unchanged; local tracker is merged, not overwritten.

## 3.2.3 — Group mixed menu & non-admin chat reliability

- Promote live-tested mixed group buttons to main group menus.
- Add 12-row selector under three quick replies.
- Allow non-deleting group decorations when Replace authorization is missing.
- Improve diagnostic status breakdown for chat/deletion queue.

## v3.2.2 — Group Button Compatibility Lab
- Static comparison of XLICON V2 and Xeon V7: XLICON mixed native-flow reference; Xeon old template buttons and outdated dependency.
- Added admin-only `.groupbuttons mixed`: 3 quick-reply + 1 single-select with 8 safe navigation rows; short fallback text remains.
- Group reply selections from common players are accepted ONLY for explicitly allowlisted harmless navigation when probe enabled; group report is allowed.
- Mixed relay includes XLICON-compatible minimal `biz/interactive/native_flow` additional nodes. No new dependencies, no session changes.
- No fake file metadata, wa protocol exploits, or execution of external repos. Live button rendering remains PENDING.

## 3.2.1 — Common Player Chat Identity Repair (P0)
- Fixed non-admin text being filtered before Chat Identity by admin-only WA_ALLOWED_JIDS; normal bot commands remain allowlisted.
- Fixed common-player DM `.chatstyle on` eligibility despite admin-only command allowlist.
- Linked group `@lid` to WhatsApp alternate JID for matching existing opt-in and equipment when provided by trusted Baileys metadata.
- Preserved raw group participant for mention/deletion, enabled privacy-safe `.wowchat diagnose` counts.
- Confirmed Explorer-style default without equipped items, with regression tests. Replace/Delete still pending live verification.

## 3.2.0 — WOW Chat Cosmetics & Group Button Lab
- Player presets 5 slots, owned-only equipment, guild tag, private chat stats.
- Admin-gated group multi-button and selector probe, fallback and feedback.
- Known bug GROUP_INTERACTIVE_BUTTONS_NOT_VISIBLE P0 tracked; not claimed fixed until WhatsApp live validation.
- Safe Replace default-off unchanged.

## v3.1.0 — Safe Replace Engine (2026-10-18)

- Opt-in per-server `.admin chat replace on|off`, per-group `.wowchat mode replace`, `.wowchat delete on|off`, per-player `.chatstyle replace on|off`. Semua OFF by default.
- Bot membalas dengan dekorasi dan mention pengirim asli; hanya mencoba revoke pesan asli setelah event Baileys delivery ACK untuk salinan bot dan verifikasi bot admin grup.
- Crash-safe SQLite state, idempotent delete request, expiration, opt-out cancels, no late deletion after restart. Default Mirror v3.0 tetap tersedia.
- Updated ENV example and guide, offline regression, source-only OneClick patch. WhatsApp live PENDING.

## v3.0.0 — Chat Identity Stage 1 (opt-in & safe mirror)

- WOW Identity Engine: decorated nickname, stable hashed tag, original WA participant mentions, inventory equipped badge/frame/title.
- Identity-only and Mirror modes. Global WOW admin and group admin controls; player DM consent and per-group blocklist. ALL OFF by default.
- Persistent SQLite outbound mirror queue with idempotent inbound source ID, per-user rate limiting, per-group backpressure and finite retention.
- Crash recovery: ambiguous in-flight work is not automatically re-sent; original message is never deleted by v3.0.0.
- 336 automated tests (323 legacy + 13 stage 1); live WhatsApp delivery pending.
- OneClick direct source-only patch specifically 2.4.1 -> 3.0.0. No change to payment/transfer/cash-out safeguards.

## v2.4.1 — Admin Server Settings & Controlled Test Funding

- Private WhatsApp admin panel, file-system allowlist bootstrap, persisted server settings and audit.
- Auction switch, transfer pilot, Arcade V spending/winning and Daily Shop limits.
- Admin wallet V grants with quotas/idempotency; `.transfer` restricted by age, activity and caps.
- Existing `.pay` and legacy direct-transfer database table remain disabled.
- No real-world payments, top-ups, cash-outs or cash-equivalent rewards.
- Source-only patch from v2.4.0; SQLite settings are not reverted by rollback.

## v2.3.0 — Adaptive seasons, guild supply, auction recovery
- Persistent weekly season rewards earned by activity, not random payout.
- Guild treasury supply purchases with role restrictions and daily member material claims.
- Auction expiry recovery on boot/interval, repeat-counterparty audit flags. Auction remains disabled by default.
- 301 offline tests passing; Live WhatsApp pending.

## 2.2.0 (2026-10-18)
- Daily Shop: rotating deterministic offers by WIB day, V debits, global stock, player quota and SQLite journal.
- Experimental auction engine: locked by default, tradable ordinary materials only, escrow/refund/settle with fee, account limits, persistence.
- Native Shop/Auction panel, local read-only JSON stats, 13 new tests, QA and new version-specific live flags.
- No direct V transfers, no topup/cashout, no public auction activation.

## v2.1.0 — Guild & Property Universe (2026-10-18)
- Guild create/join, nickname-only membership, role management and guild Hall.
- Guild treasury with V debit and nonwithdrawable investment; audited transactions, max 200 V donations/day.
- Daily guild quests and persistent global leaderboard.
- Three private property types with daily XP/material output and level upgrades.
- Community aggregate dashboard & WhatsApp native button panels.
- No top-up, no cash-out, no direct transfers, no item marketplace/auction.
- QA offline + OneClick upgrade path specifically v2.0 -> v2.1; live tests pending.

# v1.9.0 — WOW Life & Economy Integration

- Permanent V-transfer ban, including legacy `.pay` and an SQLite trigger on `transfers`; legacy historical transactions retained.
- Main-wallet V Shop and crafting with inventory items, materials accrued from existing mining, job careers and new virtual V transaction journal.
- Optional V Arcade Symbol Match and V multiplayer Risk Rooms; odds are public, RNG secure by default, daily spending/winning limits, cancel/refund and restart persistence.
- Synthetic-market tiny regression model with out-of-sample comparison and baseline fallback; no paid/real market feeds.
- Native menu panels, QA v1.9 and source-only OneClick upgrade from v1.8, no WhatsApp credentials included.
- No new unique game IDs; existing 54 modes retained. v1.7/v1.8 real WhatsApp remains untested.

# v1.8.0 — WOW PvP & Ranked/Casual Economy

- Mode terpisah bagi Chess dan Ular Tangga; matchmaking hanya menggabungkan pilihan mode yang sama.
- Hadiah V untuk menang sah Ranked (Chess checkmate dengan >=8 ply, Snakes mencapai finish); tidak ada hadiah dari resign / draw / timeout.
- Maksimal 24 V hadiah PvP per pemain per hari WIB, 2 kemenangan berhadiah terhadap lawan yang sama per hari.
- Casual tidak memberi V atau rating Elo. Blackjack memiliki pilihan mode dan riwayat hasil tanpa reward berbasis kartu.
- Idempotent, SQLite-backed PvP settlements dan journal V-Currency; restart aman.
- Panel native .pvp + privasi grup, QA live per-versi.
- Tidak ada staking, cash-out, top-up, atau pengambilan saldo lawan.

## v1.7.0 — WOW virtual life economy
- Starter account grants V once, daily mining (3/day) and a no-cost job (1/day).
- Fictional market of synthetic shares with buy/sell atomic wallet movements and deterministic daily quotes.
- Arcade (gacha, Symbol Match, Risk Rooms) earns bound V for fixed-price cosmetic shop, not spendable/stakable V.
- World/Market native button panels and automatic QA.
- Public rollout requires additional platform/legal review.

# 1.6.0 — Free Arcade (2026-10-18)
- Gacha capsule once/day; fixed 70/24/5/1% cosmetic odds and collectible registry.
- Symbol Match: ten reels, 3 symbol types; maximal identical-run length 3–10 awards nonredeemable arcade score. Three free spins/day.
- Risk Rooms: voluntary 2–8 players, public 70%/35%/10% chance tiers with 10/25/80 arcade scores, shared RNG draw, zero stakes or transferable rewards.
- SQLite persistent state, idempotency, crypto RNG, privacy pseudonyms, command/button panels; restarts preserve games.
- No money, wagering, trading, prizes of monetary value, or ML manipulation of chance. Live WhatsApp and platform/legal compliance not verified.
- Full regression + v1.6 tests; installer targets v1.5.0 only.

## v1.5.0 — Inventory & Exclusive Items (2026-10-18)

- Added: SQLite inventory stacks, cosmetic equipment slots, item event ledger, one-time starter grant, daily item claim, free-time-limited Pioneer Badge, XP consumable, Tebak Angka hint scroll, milestone unlocks, and collection/history commands.
- Changed: profile includes currently equipped items; native buttons include Inventory panel; group requests for inventory are rejected for privacy.
- Existing: 51 games, Blackjack, Chess, ML fallback, Ollama, Baileys and shutdown recovery preserved.
- Compatibility: patch is **v1.4.0 → v1.5.0 only**; source conflicts stop patch; data/auth are never in patch; new tables use CREATE IF NOT EXISTS and require no destructive migration.
- QA: 182/182 automated tests in build environment; live WhatsApp pending user validation.
- Policy: no item trading, no top-up/cash-out, no wagers, and no random paid rewards.

## v1.3.1 — Chess UX & notification repair (2026-10-18)
- Waiting queue displays count, timeout, exit and lobby.
- Both players receive durable match-found notifications; acceptance/start events notify participants.
- Board PNG automatically sent to player whose turn begins.
- Resignation, cancellation, timeout and checkmate generate private completion alerts.
- Dynamic three-button panels and multi-page navigation.
- Notification delivery with retries, bounded attempts, SQLite outbox and privacy filtering.
- Regression and offline staging; all live notifications remain unverified.

## v1.3.0 — Player Intelligence Foundation

- Player-private PvP history and aggregate statistics (`.insights`, `.insights world`).
- Pre-match rating snapshots for chess (only future matches; legacy games are not retroactively labeled).
- Offline logistic regression trainer with chronological holdout, pair cap, 8 unique players / 30 matches minimum, and Brier-score baseline check.
- Model is only used after approval; otherwise deterministic Elo matching remains unchanged.
- Dashboard displays aggregate-only analytics. No phone numbers or identifiers in public stats or exported model.
- NO new games; still 50/100. WhatsApp live QA PENDING.

# v1.2.0 — Chess Arena (Beta) — 2026-10-18

- Added chess 2-player opt-in queue, rating matching window, accept handshake, persistent board, legal moves (including castling/en passant/promotion), checkmate and basic draw conditions.
- Added visual PNG chess renderer and WhatsApp private-image handler, opt-in Elo leaderboard, move audit, timeout, and no-wager rules.
- Added native quick-reply chess panels, dashboard chess statistics, per-version QA flags and regression tests.
- Remaining: production FIDE completeness, anti-collusion measures, actual WhatsApp display confirmation, model-trained ML matchmaking, opponent notifications.

## v1.2.0 — Catur multiplayer visual (beta)

- Mempertahankan seluruh fitur v1.1 termasuk 49 game dan Ular Tangga; menambah **catur** sehingga total 50 game playable yang tercatat.
- `.chess` = panel tombol, `.chess join` = antre ranked, `.chess status`, `.chess accept`, `.chess move e2e4` = langkah UCI, `.chess board` = gambar PNG 512×512, `.chess rating`, `.chess top`, `.chess resign`.
- Pengguna hanya bisa bermain lewat chat pribadi, kedua peserta harus opt-in dan menerima pertandingan. Rating Elo dasar naik/turun hanya untuk partai >=8 ply; tidak ada taruhan atau kredit permainan.
- Mesin aturan catur mandiri agar tidak memerlukan download paket baru untuk tes offline. Saat ini **beta**: belum setara sistem catur turnamen profesional, belum ML matchmaking, tidak ada notifikasi lawan otomatis, dan belum diverifikasi live pada WhatsApp v1.2. UCI seperti `e2e4` digunakan, bukan notasi SAN.
- Untuk upgrade gunakan OneClick Installer ZIP terpisah; `INSTALL-WA-WORLD.bat` akan preview lebih dulu. Tutup proses sebelum upgrade dan backup `data/` sendiri.
- Panduan lengkap: `docs/CHESS_V12.md`. Cek `QA-ONE-CLICK.bat` lalu flag live wajib setelah memasang.

# WA-WORLD v1.2.0 — Chess PvP Ranked Beta

# WA-WORLD v1.0.0 — Developer API & JSON Extensions

**New**: local scoped developer API, revocable keys, safe JSON extensions. 48 games retained. No GitHub required.

For offline OneClick upgrade details see `docs/ONECLICK_1_0_GUIDE.md`. For key creation and API examples see `docs/DEVELOPER_PLATFORM.md`. Run `DEV-KEYS.bat` after installing the project; the starter key file is not shipped.

---

# WA-WORLD Ultimate v0.9.0 — Explorer Pack + Compatible OneClick Upgrade

**48 playable games / 100 target**, live WhatsApp connection through Baileys (unofficial), local Ollama AI (opt-in), Social Hub, V-Currency without top-up, offline quality gates.

To upgrade existing projects from **v0.5, v0.6, v0.7, v0.8.0 or v0.8.1**, extract `WA-WORLD-OneClick-Upgrade-v0.9.0.zip` **next to** `WA-WORLD-Starter/` and run `INSTALL-WA-WORLD.bat`. Installer previews changes, then accepts a single Enter confirmation. Windows admin permissions are needed only if installation directory requires it.

**Back up `data/` separately before upgrade; stop gateway/dashboard.** Source changes outside documentation and the managed updater are blocked safely. No database, session, `.env`, or `node_modules` are included in patch. Results are proven on staging copies, not on the user's actual Windows machine.

Commands: `.games`, `.games all`, `.packs4`, `.pack exploration`, `.pack data4`.

QA: Run `QA-ONE-CLICK.bat`; mark WhatsApp live tests in `QA-LIVE-RECORD.bat`. Offline PASS does not mean WhatsApp visual rendering passed.

Documentation: `docs/UPDATER_V3_POLICY.md` and `docs/PLAYABLE_GAMES.md`.

# WA-WORLD Ultimate v0.8.1 — Bootstrap-safe stability update

**36 playable games**. v0.8.1 repairs updater self-conflicts caused by legitimate Rescue Installer edits, while retaining all v0.6/v0.7/v0.8 capabilities.

For direct upgrade from v0.5, v0.6, v0.7, or v0.8 use `WA-WORLD-OneClick-REPAIR-v0.8.1.zip` and double-click `INSTALL-WA-WORLD.bat`. Please back up `data/` before updating.

See `docs/UPDATER_V3_POLICY.md` for safe source and data merge rules.

# WA-WORLD Ultimate v0.8.0 — One-click Upgrade & Game Pack 03

**36 playable games**, Baileys gateway, optional local Ollama, social hub and virtual V-Currency (no top-up/cash-out).

## Upgrade from v0.5, v0.6 or v0.7

Download `WA-WORLD-OneClick-Upgrade-v0.8.0.zip`. Extract it **next to** your existing `WA-WORLD-Starter` folder. Right-click `INSTALL-WA-WORLD.bat` → Run as Administrator **only if Windows file permissions require it** (normally double-click is sufficient). The script detects the project, performs a safe preview, and asks you to **press Enter** for the sole confirmation.

A backup of modified documentation and replaced source files is stored inside `.wa-world/backups/`. Non-document source conflicts stop the entire update. **data/, .env, WhatsApp auth state and virtual wallet storage are never in patch ZIP.** Always make an additional copy of `data/` first and close bot/dashboard. Rollback is for source files only, not for database transactions.

## Fresh install

Extract `WA-WORLD-Full-v0.8.0.zip` and open `WA-WORLD-Starter` in VS Code. Install Node.js 22.16+; run `npm test`, `start-dashboard.bat`, `start-chat.bat`, or `WA-START.bat` for WhatsApp. Runtime WhatsApp tests have not been performed on this release.

## New features

- 12 additional two-attempt games: factorial, gcd, lcm, discount, operator, quadrant, clock, Morse, palindrome, vowels, reverse word and fraction.
- `.packs3` interactive page, `.pack puzzles`, `.pack words3`, `.world`.
- Read-only, local-only `GET /api/v1/games` catalog endpoint. Not a remote developer API.
- 80 automated tests; `QA-ONE-CLICK.bat` prints mandatory and optional flags; actual WhatsApp rendering still PENDING_LIVE.

## Live smoke tests (minimum)

From a second consenting WA number test: pairing/status, `.menu` reply, native `Games` button. Optional: `.packs3` -> Puzzle -> Factorial, submit answer. Don't share auth credentials, QR codes or whole `data/` folder.

Self-hosting your bot does not host WhatsApp: Baileys is unofficial and may be incompatible with future WhatsApp changes. Use a dedicated test account and comply with applicable platform rules.

## v1.4.0 — Blackjack Multiplayer & Shutdown Recovery
- Blackjack social table (1–4 players vs dealer), no wagers/credits/prizes, with separate group lobby and DM-only hands/actions.
- Four-deck cryptographically shuffled shoe, transactionally stored hands/turn states, dealer soft-17 stand, win/lose/push results.
- Private card PNG + native panels; outbox notifications persisted to SQLite and re-sent on recovery.
- Runtime lease and heartbeat prevent simultaneous gateway processes; clock pause during planned or unexpected downtime preserves pending match TTLs.
- Graceful 10-second drain on SIGINT/SIGTERM, old chess/snakes and 50 games unchanged; 165 automated tests.
- LIVE: blackjack DM/group PNG and restart behavior remain PENDING_LIVE until user testing.

## v2.0.0 — World Intelligence & Player Stats (2026-10-18)
- [NEW] Event harian dunia dengan HMAC secret lokal, persistensi tanggal WIB, dan audit komitmen.
- [NEW] Ekspedisi gratis satu klaim/hari; reward dinamis 6–10 V sesuai jenis event, tanpa taruhan.
- [NEW] `.stats`, `.stats card`, `.stats world`, player card PNG 640×350 dan agregat global tanpa identitas pribadi.
- [NEW] `.smart on/off/recommend/like/skip/status` dengan opt-in dan penghapusan personalisasi total.
- [NEW] Online preference learner (Beta-smoothed scoring + exploration bonus), independen dari RNG permainan.
- [NEW] `/api/v1/world` server-local dan World Intelligence panel WhatsApp.
- [TEST] 261 tes otomatis. Memperbaiki kondisi tes Blackjack lama yang kadang otomatis berakhir saat deal, tanpa mengubah engine Blackjack.
- [UNCHANGED] 54 game/mode, larangan V transfer/top-up/cash-out, ledger, persistent matches, dan backup source.
- [PENDING] QA live WhatsApp v2.0 dan audit kesiapan publik/anti-abuse.

## v2.4.0 — WOW Social World & Group Guild Gameplay
- Native WhatsApp group guild linking with verified group-admin and guild-owner checks; fails closed.
- Group quests, cooperative Guild Rally (+20 Guild XP; 0–10 prior-day World Pulse bonus), anonymous-by-default weekly contributor board.
- Server World Pulse and bounded activity-based World Reputation embedded in PNG player card.
- Read-only aggregate dashboard endpoint `/api/v1/world-social` and replay/persistence tests.
- No new V transfer or chance-game payout mechanism; existing experimental auction remains OFF.
- Group commands require explicit `WA_ENABLE_GROUPS=true`. User live tests PENDING.
