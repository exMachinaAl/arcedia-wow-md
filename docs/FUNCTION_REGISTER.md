## v1.2 — Chess Ranked Beta
- [x] Consent-based matching, persistent match records, UCI move validation, rating, move history
- [x] PNG board, private image handler and native quick reply panel
- [x] No gambling / no V-Currency wager
- [ ] Actual WhatsApp live validation (two accounts and image rendering)
- [ ] Full competitive FIDE rules, disconnect adjudication, collusion detection
- [ ] ML-trained matchmaking and adaptive model

## v1.1 Universal Multiplayer Engine (Beta)
- [x] Persistent two-player queue, accept handshake, turn engine, match audit and PNG board render
- [x] DM-only WhatsApp command and native button panel
- [ ] Chess engine and rated matchmaking; no ML matchmaking yet
- [ ] Multi-player blackjack simulation, inventory/item system
- [ ] Real-device live QA v1.1 pending

## v0.7.0 social/multiplayer/virtual economy update

- `I-03` **PROTOTYPE:** approved nickname friends, inbox, declined invite cooldown, blocks and private-only commands.
- `G-05` **PROTOTYPE:** 2-player asynchronous suit challenge with deterministic status and no wager. Duel mode does NOT count as a 25th unique game.
- `E-03` **PROTOTYPE:** consensual transfer between friends, off by default; max 50 V per action/100 V day WIB; balanced signed transfer entries, no top-up/cashout. This is not a financial wallet.
- `W-07` **PROTOTYPE:** native social navigation; live confirmation v0.7 pending.
- `O-08` **PROTOTYPE:** new version-specific QA gates, offline social security tests and anonymized dashboard counts.
- Deferred: production-grade distributed idempotency/outbox, scalable database, payment subscription separate from virtual money, moderation workflow, ML anti-abuse model, 76 additional distinct games.

## Update v0.6.0 feature register

Implemented: Game Pack 02 (8 new puzzle mechanics, 24 game commands playable total), two-page native pack navigation, optional local Ollama text/JSON API, opt-in/opt-out, per-tier rate caps, loopback-only HTTP model requests, per-event deduplication, revised QA manifest and release-isolated live QA records.

Not yet implemented: custom trained ML models, machine-learning personalization, independent client application, actual subscription payment flow, comprehensive moderation/spam safeguards, 100 distinct deep games, production multi-instance message queue and PostgreSQL cluster. V-Currency purchase/top-up remains forbidden.

# WA-WORLD — Function Register (never silently remove requirements)

Statuses: `PLANNED` = design backlog, `PROTOTYPE` = coded but not production ready, `VERIFIED` = acceptance criteria and tests passed in target environment.

| ID | Capability | Target | Current status |
|---|---|---|---|
| W-01 | WhatsApp Web pairing and reconnect (Baileys) | initial | PROTOTYPE / needs live validation |
| W-02 | Connection monitoring and durable inbox/outbox | scale | PLANNED |
| W-03 | WhatsApp group multiplayer and moderation | scale | PLANNED |
| W-04 | Channel abstraction (future other transports) | core | PLANNED |
| I-01 | Persistent account identity and FREE tier | initial | PROTOTYPE |
| I-02 | Verified identity linking and profile privacy | scale | PLANNED |
| I-03 | Friends, party, clan, achievements | scale | PLANNED |
| I-04 | Admin/moderator/developer RBAC | scale | PLANNED |
| G-01 | Command parsing and game registry | initial | PROTOTYPE |
| G-02 | Three prototype games (coin/RPS/guess) | initial | PROTOTYPE |
| G-03 | Ten validated unique game mechanics | next | PLANNED |
| G-04 | 100 truly unique playable games | long-term | PLANNED |
| G-05 | Turn-based/asynchronous multiplayer and matchmaking | scale | PLANNED |
| G-06 | Leaderboards, tournaments, seasons | scale | PLANNED |
| G-07 | Fair-play rules, cooldown, anti-cheat | scale | PLANNED |
| E-01 | V-Currency transactional ledger | initial | PROTOTYPE |
| E-02 | No top-up, no withdrawal, no real-money exchange | always | DESIGN RULE |
| E-03 | Earn/sink balance, anti-inflation analytics | scale | PLANNED |
| E-04 | Rate limits, fraud review, event reconciliation | scale | PLANNED |
| A-01 | Local LLM conversations with privacy controls | later | PLANNED |
| A-02 | Structured JSON engine with schema validation | later | PLANNED |
| A-03 | Machine-learning personalization | later | PLANNED |
| A-04 | Machine-learning anti-cheat | later | PLANNED |
| A-05 | AI Game Master and adaptive difficulty | later | PLANNED |
| A-06 | Dedicated AI job queue and GPU scheduling | later | PLANNED |
| S-01 | All catalog content accessible by FREE accounts | always | DESIGN RULE |
| S-02 | Priority queue tiers without content locks | later | PLANNED |
| S-03 | Payment processing completely separate from V-Currency | later | PLANNED |
| D-01 | Sandboxed plugin APIs and docs | later | PLANNED |
| D-02 | Developer auth keys, scopes, quotas and revocation | later | PLANNED |
| D-03 | SDK, testing sandbox, extension review | later | PLANNED |
| O-01 | Read-only local status dashboard | initial | PROTOTYPE |
| O-02 | Audit logging and incident response | next | PLANNED |
| O-03 | Automated tests and CI | initial | PROTOTYPE |
| O-04 | Database backups and migrations | next | PLANNED |
| O-05 | Moderation and abuse reports | scale | PLANNED |
| C-01 | Independent WA-WORLD client / chat clone experience | long-term | PLANNED |
| C-02 | Own secure chat transport, shared user identity | long-term | PLANNED |

The **100 distinct game ideas** are in `GAME_CATALOG.csv`; ideas are not deployed games. Promote statuses only after coding, tests and verification. Do not count commands or alternate skins as standalone games.

## v0.3 transport / button QA
- Baileys QR and session restore, reconnect backoff (code ready, live testing pending)
- `.buttons text|legacy|native` (native and legacy experimental)
- `.tap 1|2|3` guaranteed text-command fallback when messages deliver
- `.buttoncheck shown|hidden|clicked`, button response normalization, local gateway diagnostics
- Pending: real device validation, policy review, secured auth persistence for production


## v0.4 features (2026-10-17)
- W-05: Dynamic native-flow user interface panels (Home / Games / Coin / RPS / Profile) — PROTOTYPE (24 offline tests pass; live UI not yet checked)
- E-05: Once-a-day WIB reward (10 V + 5 XP), streak and transaction ledger — PROTOTYPE
- E-06: Daily cap of 100 V from new game wins, excludes separate daily claim — PROTOTYPE
- I-05: Player XP/level, plays and winning rewards — PROTOTYPE
- G-08: Explicit opt-in nickname leaderboard, JID hidden — PROTOTYPE
- O-06: Daily claims and XP dashboard metrics — PROTOTYPE

## v0.5 feature registry (2026-10-17)

- G-03: 16 coded game mechanics in total (3 existing + 13 new), verified by offline regression, not live WhatsApp yet — **PROTOTYPE**.
- G-09: Persistent per-player puzzle sessions (15-minute expiry), letter guesses and word chain — **PROTOTYPE**.
- I-06: Six badge achievements derived from existing player/claim stats — **PROTOTYPE**.
- E-07: Three daily missions with single-claim V-Currency rewards, separate from capped game win rewards — **PROTOTYPE**.
- W-06: Four additional native button packs `.packs`, `.pack lucky|brain|word` — **PROTOTYPE**; live rendering pending.
- O-07: One-click automatic QA, operator live test records and mandatory/optional flags — **OFFLINE TESTED**.
- G-04 still targets 100 truly unique games; **84 remain**; no feature is considered fully verified without required live checks.

### v1.4.0 Blackjack Social & Downtime Resilience
- Blackjack room with private hand, join, 1–4 seats, hit/stand, dealer completion, result (no wagers): IMPLEMENTED / OFFLINE TESTED.
- Group-linked invitation and read-only group board: IMPLEMENTED / LIVE PENDING (WA_ENABLE_GROUPS optional).
- PNG private cards: IMPLEMENTED / OFFLINE TESTED / LIVE PENDING.
- Persistent Blackjack notifications, restart-safe shoe: IMPLEMENTED / OFFLINE TESTED.
- Gateway runtime lease, heartbeat and resumed timeouts for chess/snakes/Blackjack: IMPLEMENTED / OFFLINE TESTED / LIVE PENDING.
- Existing v1.3.1 live chess notifications: user-reported 3/3 PASS on 2026-10-18.

## Inventory v1.5

Item registry; stack ownership; equipment cosmetic slots; one-time starter, one-per-day free item, Pioneer badge limited free period, milestone cosmetics, consumable XP and guessing hint; collection and audit history; duplicate protection; SQLite persistence; private-only DM command handling. No item trading, top-up, exchange for money, wagers, paid spins, crafting or public marketplace at this stage.


## v1.6 — Free Arcade (Implemented)
- `.arcade` hub, `.gacha claim|odds|collection`: no-purchase cosmetic draw 1/day WIB; 70/24/5/1% fixed rarity. Duplicate retains collection only.
- `.slot spin|odds`: 10 independent 3-symbol positions; longest identical consecutive run yields score if >=3. Three free plays/day. Score cannot transfer, redeem, or purchase anything.
- `.risk create|join|choose|status|leave|resolve`: opt-in 2–8-player cooperative choice room, shared RNG draw, 70%/35%/10% publicly announced; nonredeemable score, no stake or loss.
- Crypto RNG + SQLite atomic writes + event dedup, daily limits. All free and private DM only.
- **Not yet**: WhatsApp live validation, PNG slot visuals, crafting, paid prizes, public policy/legal clearance, ML odds manipulation (forbidden).

## v1.7 — WOW Economy
- DONE: One-time V starter, mining 3/day, work 1/day, fictional deterministic market, atomic buy/sell, ledger.
- DONE: Non-transferable Arcade V as rewards on free gacha/slot/risk with daily cap; fixed-price cosmetic shop.
- TODO: Ranked/casual opt-in and skill rewards for PvP without V wagering. ML/LLM economy models after data validation.

## v1.8 WOW PvP Economy
- Ranked/Casual preferences: `.pvp`, `.pvp mode`, `.pvp stats`, `.pvp history`.
- Matchmaking chess/snakes mode separated; previous defaults preserved. Blackjack tracks score-only, no random reward V.
- Chess checkmate >=8 ply rewards +12 V in Ranked; snakes reaching square 100 rewards +8 V; no V from resignation, abandon, draw or timeout.
- Per-user daily cap 24 V, 2 qualified paid wins versus one opponent/day, exactly-once DB settlement and ledger.
- No buy-ins, no betting against other users, no cash-out, no real-world value. See `docs/PVP_ECONOMY_V18.md`.
