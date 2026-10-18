## v2.3 handoff
OneClick baseline v2.2.0 only. 301 offline tests. Commands `.season`, `.guildshop`, `.dailyshop`. Old `.pay` disabled. Experimental Auction OFF. Live QA PENDING. Rollback reverts source only; snapshot DB before update. See `docs/ADAPTIVE_ECONOMY_V23.md`.

## Current release: v2.3.0
Daily Shop active; Auction foundation disabled by default. OneClick upgrade requires exact installed v2.1.0. See docs/DAILY_SHOP_AUCTION_V22.md.

# WA-WORLD Handoff v2.1.0
Baseline patch: v2.0.0 → v2.1.0 only. Guild / Property source in `src/world-community.js`, migrated by `initWorldCommunity(db)` from `src/db.js`. Persistent SQLite in local `data/` (excluded from patch). **No direct V transfer**, no top-up, no cash-out. Required tests `npm test`, optional `QA-ONE-CLICK.bat`. `LIVE_COMMUNITY` pending; real WhatsApp not tested. Guild and properties DM-only. Next up v2.2 daily shop & auction escrow after policy/abuse review.

# WA-WORLD — Handoff v1.2.0
Session: GPT-6A29EB-20261016-B20C6A4DA9
Base: canonical Full v1.1.0; new Chess Beta module src/chess.js + src/chess/{engine,board-png}.js.
Running under Node 22.16+ and node:sqlite; 132/132 automated tests PASS in builder environment. Gameplay live WhatsApp v1.2 PENDING.
Install from OneClick ZIP v1.2; supports direct upgrade from supported older versions only if source hashes match. Database/session excluded from patch; source rollback does not roll back database changes.
Chess commands: .chess join / status / accept / move e2e4 / board / rating / top / resign / leave. No ML trained model yet; rating matchmaking only.
Other game baseline 49; chess added gives 50/100. Nothing is verified on user Windows v1.2 yet.


## v1.3.1 handoff
- Baseline v1.3.0 only. Fix user-reported chess UX deficits; no additional games.
- Chess event outbox in SQLite (idempotent under processed_messages); private JID notifications from Baileys poller; runtime test pending.
- Incoming `.chess` commands produce state-specific panels; navigation `.nav arena|more|explore` provides hierarchical 3-button UI.
- Live QA mandatory: match found notification, turn board, winner notice. Next phase: v1.4 inventory or chess accessibility, depending on QA.


## Latest v1.5.0
Baseline v1.4.0. Offline patch only. New inventory module in `src/inventory.js`; DB initializer in `src/db.js`; commands in `src/core.js`; Buttons and handler panel; 17 new regression tests. Test WhatsApp live UI still pending. See `docs/INVENTORY_V15.md`.


## Handoff v1.6.0
Baseline required for next patch: WA-WORLD v1.6.0. Three free arcade games added, 54/100 registered. Never add paid spins, bets, cashout, transferable arcade currency, or ML-altered odds. All probability rewards are cosmetic/non-monetary. Live QA must remain PENDING until user submits actual WhatsApp test. Planned: crafting/seasonal cosmetics, opt-in ML recommendations, enhanced PNG reel visuals.

## Handoff v1.7.0
Installed baseline for the next release is v1.7.0. WOW economy adds starter V, mining, guaranteed virtual jobs, and a fictional market that uses spendable V. Chance-based free arcade outcomes mint ONLY non-transferable Arcade V to purchase deterministic cosmetics. No stakes, no paid spins, no real assets. Full V-Currency cannot be acquired from gacha/slot/risk results. No ML forecasting is claimed: outlook is heuristic. Ranked/casual PvP V rewards and economy ML are explicit future milestones. All ongoing multiplayer state stays in SQLite and survives gateway downtime. Test version 1.7 live separately.

## Handoff v2.0.0
- Baseline **1.9.0 only**. New module `src/world-intelligence.js` initialized in `src/db.js`, routed before legacy economy through `src/core.js`, aggregated on dashboard `/api/v1/world`.
- User consent is required for online preference learning. `.smart off` deletes recommender tables for that user. No chance game results are adjusted by model.
- Event of the day uses HMAC with local SQLite seed, stable after restart; quest reward 6–10 V once per day; player card 640×350 PNG direct DM.
- QA tests 261/261 in build environment; WhatsApp live pending. Next goal guild/properties and daily shop; escrow transfer stays disabled pending abuse/legal review.
- Patch direct **1.9.0 → 2.0.0**. Data directories and `.env` are never included in patch; source rollback cannot reverse new database tables.

## v2.4 handoff
Guild-group linking, worldpulse, reputation, Rally XP, and QA 315 tests added. See docs/WOW_SOCIAL_WORLD_V24.md. Stop minor patch iteration after this upgrade and await user evaluation.
