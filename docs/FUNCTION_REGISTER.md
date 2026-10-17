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
