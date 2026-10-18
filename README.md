## WOW v3.4.0 — Interactive World Hub & Chat Signatures
- `.menu` in DM: choose World / Games / Economy / Identity / Arena; every hub provides quick replies plus multi-row native selector.
- `.hub games|world|economy|identity|arena`: skip typing via hierarchical navigation.
- `.chatstyle signature shop`: prices for exclusive *account-bound* decorations, paid only with earned V.
- `.chatstyle signature buy spark` (40 V), `buy royal` (120 V), `buy guild` (180 V); then `use spark|royal|guild`; `off` reverts to default.
- Purchases are atomically debited in SQLite with purchase journal, never transferred or redeemable.
- `.chatstyle on` remains player opt-in, required for mirroring in group; no equipment needed for EXPLORER default.
- Group Mixed Button stays compatible; player DELETE still **PENDING_LIVE** and no unsafe bypass of ACK checks.
- The existing Blackjack PNG and phase-aware controls remain. Avoid manual command entry where navigation exists.
- Backup `data/` and preserve `.env` and WA auth. Do not copy env examples over your .env.

# WOW V3.1 Stage 2 — Safe Replace Engine

Patch langsung v3.0.0 → v3.1.0. Baca `docs/WOW_V3_SAFE_REPLACE_STAGE2.md`. Konfigurasi tersedia pada `config/ENV_V31_EXAMPLE.env.txt` (template aman; **jangan timpa .env aktif**).

**Replace default OFF** dan bersifat opt-in 3 lapis. Jika receipt atau hak bot admin tidak dapat diverifikasi, **pesan asli tetap ada**. Pengujian live masih PENDING.

# WOW V3 Chat Identity — tahap pertama

Upgrade v3.0.0 dari v2.4.1 menambahkan chat mirror khusus grup dengan identitas WOW/equipment. Secara default semuanya OFF, **tidak menghapus pesan asli**.

Panduan instalasi, pengaktifan admin/grup/pemain, keamanan, dan tes: `docs/WOW_V3_CHAT_IDENTITY_STAGE1.md`.

## WOW v2.3 — Adaptive World & Guild Supply

New: `.season`, `.season progress`, `.season claim` (weekly activity-based 15 V), `.guildshop`, `.guildshop buy copper|iron`, `.guildshop claim`. 3-mining OR 2-expedition milestones; no topup, cashout or direct V transfers. The experimental auction remains OFF by default. Gateway startup and once-per-minute sweeps settle **existing expired auctions** transactionally, including after restart; repeated seller-buyer pairs trigger rules-based checks. This is not a trained ML model. See `docs/ADAPTIVE_ECONOMY_V23.md`.

# WA-WORLD v2.2.0 — Daily Shop & Auction Foundation

Daily Shop aktif di chat pribadi: `.dailyshop` → `.dailyshop buy SKU 1` → `.dailyshop history`. Rotasi berdasarkan kalender WIB dan stok terbatas. Lelang material hanya modul eksperimen dan **OFF secara default**; jangan aktifkan publik sebelum evaluasi kebijakan dan anti-abuse. Tidak ada top-up, cash-out, transfer V langsung, perdagangan item gacha atau kosmetik eksklusif.

Patch hanya dari **v2.1.0 → v2.2.0**. Ekstrak OneClick ZIP di samping `WA-WORLD-Starter`, tutup bot/dashboard, backup `data/`, lalu `INSTALL-WA-WORLD.bat` (preview kemudian Enter). QA `QA-ONE-CLICK.bat`. Baca `docs/DAILY_SHOP_AUCTION_V22.md`.

---

# WA-WORLD v1.9.0 — WOW Life & V Economy

# WA-WORLD Ultimate v1.7.0 — Free Arcade

**Previously added in v1.6:** `.arcade`, `.gacha claim`, `.slot spin`, `.risk create` (2–8 players) plus native quick-reply panels. No bets, top-up, cash-out, transferable prizes or paid spins; ML never changes fixed odds. Three games added (54/100 registered).

**Upgrade:** Use WA-WORLD-OneClick-Upgrade-v1.7.0.zip **only from v1.5.0**. Close bot/dashboard and back up `data/` first. Native gameplay must be confirmed in your WhatsApp; offline QA is not live validation.

# WA-WORLD Ultimate v1.5.0 — Inventory & Exclusive Collection

**Upgrade baseline:** v1.4.0 only. Gunakan `WA-WORLD-OneClick-Upgrade-v1.5.0.zip` untuk proyek yang sudah terpasang dan memiliki database/sesi lama. **Jangan** mengekstrak Full Project untuk menimpa instalasi lama.

## Inventory & Item System (baru)

- `.inventory` atau `.inv`: daftar semua item milik akun.
- `.item help`, `.item list`, `.item info focus-token`: informasi item dan rarity.
- `.item claim starter`: satu kali per akun, +2 Focus Token dan +1 Hint Scroll.
- `.item daily`: satu item gratis per hari WIB (bergantian terjadwal, bukan undian atau taruhan).
- `.item use focus-token`: konsumsi token → +10 XP, maksimum satu kali per hari WIB.
- `.guess start` lalu `.item use hint-scroll`: konsumsi satu scroll, beri petunjuk angka, tanpa mengungkap nilai pasti.
- `.item claim pioneer`: badge LEGENDARY gratis sampai 31 Desember 2026 WIB; bukan barang jual-beli.
- `.item claim milestones`: Jade Frame setelah 10 game dan Veteran Title setelah 25 game.
- `.item equip pioneer-badge`, `.item unequip badge`, `.collection`, `.item history`.
- Equipment kosmetik terlihat di `.profile` dan **tidak** mengubah peluang/rating catur ranked, blackjack, atau RNG.
- Kepemilikan di SQLite, journal item event, idempotensi berdasarkan event; tidak ada top-up, cash-out, item trading, atau pembelian lootbox.
- Operasi item hanya lewat DM agar tidak mengekspos inventaris pemain ke grup.

**Data tetap aman ketika server shutdown:** SQLite milik proyek terus digunakan, tidak dikemas dalam patch. Item dan equipment tersimpan saat bot restart. Untuk backup, matikan bot/dashboard dengan Ctrl+C dahulu dan cadangkan seluruh folder `data/`.

**QA:** 182 automated tests termasuk 17 test baru; `QA-ONE-CLICK.bat` untuk pemeriksaan offline. Hasil UI WhatsApp harus diberi `PENDING_LIVE` sampai diuji. Minimal DM `.item claim starter`, `.inventory`, `.item claim pioneer`, `.item equip pioneer-badge`, `.profile`.

**Keterbatasan:** belum ada shop, crafting, item marketplace, battle equipment, gacha, atau raritas yang mengubah keberuntungan. Ini fondasi item yang bisa dikembangkan. Tidak ada ML baru dalam rilis ini. Tidak ada penambahan game; jumlah tetap 51.

---

# WA-WORLD v1.3.1 — Chess UX Recovery

**Baseline: v1.3.0 only.** New chess notification outbox automatically informs opted-in participants when a match is found, accepted, moves, finishes or expires. Notifications survive bot restarts. On next player's turn, the board is sent as PNG.

Start: `WA-START.bat`. Run QA: `QA-ONE-CLICK.bat`.

WhatsApp menus are intentionally split into pages of three quick-replies per message: `.menu` → Games / Arena / Lainnya. `.nav arena`, `.nav more`, `.chess lobby`, `.chess status`, `.chess cancel`, `.chess leave`.

**Caveat:** transport acknowledgment does not prove user received/read. The outbox provides at-least-once delivery, so duplicates are possible after an uncertain network failure. No group broadcasting, no wagers, no top-ups. WhatsApp device testing remains pending.

---

## v1.3.0 — Catur multiplayer visual (beta)

- Mempertahankan seluruh fitur v1.1 termasuk 49 game dan Ular Tangga; menambah **catur** sehingga total 50 game playable yang tercatat.
- `.chess` = panel tombol, `.chess join` = antre ranked, `.chess status`, `.chess accept`, `.chess move e2e4` = langkah UCI, `.chess board` = gambar PNG 512×512, `.chess rating`, `.chess top`, `.chess resign`.
- Pengguna hanya bisa bermain lewat chat pribadi, kedua peserta harus opt-in dan menerima pertandingan. Rating Elo dasar naik/turun hanya untuk partai >=8 ply; tidak ada taruhan atau kredit permainan.
- Mesin aturan catur mandiri agar tidak memerlukan download paket baru untuk tes offline. Saat ini **beta**: belum setara sistem catur turnamen profesional, belum ML matchmaking, tidak ada notifikasi lawan otomatis, dan belum diverifikasi live pada WhatsApp v1.2. UCI seperti `e2e4` digunakan, bukan notasi SAN.
- Untuk upgrade gunakan OneClick Installer ZIP terpisah; `INSTALL-WA-WORLD.bat` akan preview lebih dulu. Tutup proses sebelum upgrade dan backup `data/` sendiri.
- Panduan lengkap: `docs/CHESS_V12.md`. Cek `QA-ONE-CLICK.bat` lalu flag live wajib setelah memasang.

# WA-WORLD v1.3.0 — Chess PvP Ranked Beta

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


### v1.3 Player Intelligence
`.insights` for private PvP stats; `.insights world` for aggregate counts; `.model status` for matchmaking mode. Optional: `ML-TRAIN.bat` locally trains a model **only after enough valid games**. Until then matchmaking remains Elo/FIFO. Never upload database or credentials in a bug report.

## v1.4 Blackjack & server recovery
- Open DM: `.bj help` / `.bj create` / `.bj join CODE` / `.bj start` / `.bj hand` / `.bj hit` / `.bj stand`.
- Group-linked tables: set `WA_ENABLE_GROUPS=true` in local `.env` **only after deciding to enable group commands**, then `.bj group` in group and `.bj join CODE` in private DM. No private hands in groups.
- No wagering and no V-Currency payout, cash-out or top-up in Blackjack.
- See `docs/BLACKJACK_V14.md` and `docs/SHUTDOWN_RECOVERY.md` before restarting during a live match.
- Stop the bot with Ctrl+C when possible, backup `data/` while server is stopped, install ZIP, then restart. The pending match and private cards remain stored and timeouts are paused for downtime.
- v1.4 WhatsApp delivery has not yet been live-verified. Always run offline QA first.

## WOW World of WA v1.7
Use `.wow` for your virtual world, `.mine` and `.work complete` for guaranteed daily virtual income, and `.market` for fictional assets. `.wow wallet` splits spendable V from non-transferable Arcade V earned without stakes, which can be redeemed only for deterministic cosmetic items via `.wow shop`. This is not real-money trading or gambling. See docs/WOW_ECONOMY_V17.md.

### v1.8 Ranked/Casual & WOW PvP
Perintah `.pvp` melihat mode per game; `.pvp mode chess casual` mengganti mode di luar antrean atau match aktif. Dua akun bisa mencoba `.chess join casual`, `.chess accept`, dan bermain tanpa mengubah Elo atau mendapat V. Ranked menggunakan `.chess join ranked` atau `.queue join snakes ranked`. Kemenangan sah di mode Ranked menghasilkan V berbatas, **bukan saldo lawan dan tidak terkait taruhan**. Blackjack hanya statistik, tidak memberikan reward V berbasis peluang kartu. Lihat `docs/PVP_ECONOMY_V18.md`. Jalankan `QA-ONE-CLICK.bat` setelah upgrade.

## New in v1.9
See `docs/WOW_LIFECYCLE_V19.md`. Non-transferable V-Currency now buys items, crafts collectibles and can enter optional simulated V Arcade. `.pay` is permanently disabled; no topup or cashout. WhatsApp live QA is pending. Upgrade only from v1.8.0.

## WOW World Intelligence v2.0
Paket ini melanjutkan langsung dari versi 1.9.0 dengan **world event** (`.world event`), **ekspedisi V** (`.world quest`), **kartu statistik gambar** (`.stats card`), statistik agregat (`.stats world`), dan pembelajaran preferensi opt-in (`.smart on`, `.smart recommend`, `.smart off`). Lihat `docs/WORLD_INTELLIGENCE_V20.md` untuk batasan dan keamanan. Tanpa top-up/transfer/cash-out; tidak ada ML yang memanipulasi RNG game.

## WOW v2.1 Guild & Property
Guild baru: `.guild` / `.guild create NightWolves` / `.guild join NightWolves` / `.guild quest` / `.guild donate 20` / `.guild upgrade`. Properti: `.property list` / `.property buy home` / `.property collect home` / `.property upgrade home`. Petunjuk lengkap `docs/GUILD_PROPERTY_V21.md`. Sesi WhatsApp dan database tidak ikut ZIP update. Live QA masih menunggu.

## v2.4 — Social World / Guild in WhatsApp Group

- `.guildgroup link`: requires a guild Owner who is also a verified WhatsApp group admin. Group commands are OFF by default: enable `WA_ENABLE_GROUPS=true` in your private `.env` and consider `WA_ALLOWED_JIDS` for testing.
- `.guildgroup quest` enables cooperative daily guild quests inside the linked group; two distinct participants unlock `.guildgroup rally` for once-daily Guild XP.
- `.guildgroup board` displays opt-in nicknames only; `.guildgroup unlink` requires verified guild owner/admin.
- `.worldpulse` measures **yesterday's** complete server activity and affects only guild rally XP (+0/+5/+10), never V wallet or random game odds.
- `.reputation` and `.stats card` show transparent activity-derived reputation; guild stats in dashboard and `/api/v1/world-social` are aggregate only.
- **No money, top-up, cash-out, direct V transfer. Auction remains OFF.** Group link, cards, admin resolution and interface require WhatsApp live verification; offline QA is not a live pass.
- See `docs/WOW_SOCIAL_WORLD_V24.md`. After v2.4, pause low-impact enhancements for stakeholder evaluation.


## WOW Admin Control Center v2.4.1

Panduan: `docs/WOW_ADMIN_SERVER_SETTINGS_V241.md`. Untuk setup admin tanpa edit manual `.env`, kirim `.whoami` via DM, lalu jalankan `SETUP-WOW-ADMIN.bat` di PC server. Setelah restart, gunakan `.admin show` atau `.server show`, dan `.admin grant me 500` untuk mendapatkan V simulasi guna uji fitur berbayar V. Auction & transfer OFF secara default.


## WOW v3.2
Lihat `docs/WOW_V32_COSMETICS_AND_GROUP_BUTTONS.md` untuk preset chat, stats, dan investigasi tombol grup. Template `config/ENV_V32_EXAMPLE.env.txt` disertakan; jangan menimpa `.env` lama.

## WOW v3.2.1 — Common Player Chat Hotfix
Jika chat anggota biasa tidak muncul di Mirror, upgrade dari v3.2.0 lalu baca `docs/WOW_V321_COMMON_PLAYER_FIX.md`. Tidak harus punya badge/equipment: default Explorer aktif. `WA_ENABLE_GROUPS=true`; pemain `.chatstyle on` via DM; admin grup `.wowchat diagnose`. Jangan aktifkan Delete sebelum tes common member berhasil. Template ENV tambahan ada di `config/ENV_V321_EXAMPLE.env.txt` (tidak menimpa `.env`).


### v3.2.2 Group Button Compatibility Lab
With WA_ENABLE_GROUPS=true and WOW_GROUP_BUTTONS_PROBE=true in existing .env, verified group admins can try `.groupbuttons mixed`: three quick replies plus a selector with eight menu rows. Use `.groupbuttons report shown|hidden|clicked` to record phone display. Admin control and per-group cooldown remain. No client-side visibility guarantee, no changes to delete/replace, no account credentials from external reference repos.


## WOW v3.3 — Mixed private buttons and Blackjack
Use `.menu` in DM to navigate 12 categories with 3 quick-reply buttons and one selector. In DM, `.bj create` -> tap `Mulai` -> inspect the hand PNG -> tap `Hit`, `Stand`, or `Kartu`. Lobby join codes still need to be shared by the host, but actions are button-based. Admin can try `.buttons mixed` via private chat.

For group chat Replace, common-player original deletion remains a **live failure** on the previous version and is not claimed fixed. The incoming original group message key is now preserved for faithful revoke requests; monitor `.wowchat diagnose`, and use Mirror in public groups until a real common-player deletion passes.
