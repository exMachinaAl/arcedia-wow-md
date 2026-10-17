# WA-WORLD Ultimate — Master Product Requirements (v0.1)

Session reference: `GPT-6A29EB-20261016-B20C6A4DA9`  
Status: **working draft** · Owner approvals pending · 2026-10-17

## Product vision
A WhatsApp-first interactive platform: universal identity, AI multimodel, 100+ genuinely distinct games, fair free access with optional priority service, developer tooling, self-hosted services, and a closed-loop fictional V-Currency. Future optional independent client expands the UI, without replacing WhatsApp as a primary channel.

## Non-negotiable constraints
1. WhatsApp stays the primary distribution surface.
2. Entire product capability remains available to free users. Paid access can improve queues, compute allowances, or response priority, not unlock core game catalog content (subject to platform rules).
3. **No V-Currency top-ups, purchases, deposits, cash-outs, or real-money redemption.** Currency rewards only from platform-defined actions; this is simulation, not an investment instrument.
4. Persistent game state and ledger must survive restarts. Each reward/transfer must have a unique event ID and auditable transaction log.
5. Developer capabilities require independent scopes, quotas, audit logs, revocation, and environment separation.
6. Security/privacy rules apply to game data, account identifiers, WhatsApp pairing secrets, AI prompts, and economy activity.
7. WhatsApp integration must be replaceable: unofficial Baileys poses instability and possible policy/account restrictions. Do not build spam/bulk messaging features.
8. ML and LLM inference must be viable locally; no requirement for paid model APIs. Exact model choice is open, and hardware cost exists.

## User roles (proposed)
- Player FREE: every game, AI/basic tools when available, standard queue.
- Player PRIORITY: identical content; preferred compute queue subject to fairness limits and no unrestricted WhatsApp throughput claims.
- Moderator: review abuse reports/flagged content and suspend game privileges, no unrestricted economy editing.
- Game Developer: plugin sandbox, versioned APIs, quotas; no direct DB access.
- System Operator: deployment, uptime, backups; limited ability to change user economies.
- Owner/Super Admin: audited high-risk changes through least-privilege mechanisms and preferably two-person approval for large adjustments.

## Major feature families
- W01 WhatsApp gateway: pairing, event receipt, reconnect, command parser, opt-in, group policy, adapter replacement.
- I01 Identity/social: unified account, profile, identity linking, consent, roles, clans/friends, sessions.
- G01 Game platform: discover, start, save, resume, multiplayer, ranked, events, rewards, anti-cheat, 100 unique games.
- E01 Economy: V-Currency, append-only ledger, rewards, sinks, limits, audit, fraud controls, supply metrics; no buy/sell/redeem.
- A01 AI multimodel: tool/JSON contracts, LLM chat/NPC, ML recommendation/anti-cheat/adaptive difficulty, local inference/queue, safety.
- S01 Subscription/quality: FREE access, fairness-bound priority, limits, operational billing separated from V-Currency.
- D01 Developer platform: API keys, SDK, plugin system, testing sandbox, scope-limited extension registry, usage logs.
- O01 Operations/security: admin UI, metrics, SLOs, moderation, audit trail, backup/restore, incident response.
- C01 Client app (later): proprietary WA-WORLD messenger/social UI, separate transport, shared accounts and game data; never represent it as official WhatsApp client.

## User journeys (initial)
1. Player sends `.menu` on WhatsApp; bot shows commands and game navigation.
2. Player starts mini-game; per-user state is stored and survives reconnect.
3. Game win awards V-Currency once; repeated event cannot duplicate credit.
4. Player sends `.wallet` and sees ledger-backed balance.
5. Bot disconnects; operator gets diagnostic info; connection retries with bounded backoff.
6. Administrator reviews status dashboard without receiving secrets or private chats.

## MVP acceptance criteria
- Test local simulator functional independent of live WhatsApp.
- SQLite ledger transactions (event IDs unique) and restart persistence pass automated tests.
- Three DIFFERENT playable mechanic prototypes (coin, RPS, number guess).
- Read-only dashboard displays progress and non-sensitive local stats.
- WhatsApp adapter is opt-in and not treated as production stable until live test.
- Security basics: isolated session secrets, private-by-default service binding, default off for group processing.

## Roadmap
- Phase 0: vision, scope, 100 candidate game ideas, risk register.
- Phase 1: local runnable core + message router + economy prototype + basic 3 games + dashboard.
- Phase 2: Baileys proof-of-concept, hardened auth, observability, practical load tests.
- Phase 3: Postgres, queue, 10–20 games, multiplayer, anti-cheat and durable message outbox.
- Phase 4: self-hosted AI LLM and ML services, structured JSON engine.
- Phase 5: 100 playable/QA-approved games, developer APIs, subscription priority.
- Phase 6: WA-WORLD independent client and multi-channel expansion.

## Explicit out of scope for v0.1
Real subscriptions/payments, peer-to-peer currency transfer, top-ups, cashouts, AI inference, WhatsApp integration guarantees, production public deployment, automatic unsolicited messaging, high-scale processing.

## Known high-risk dependencies
- Unofficial WhatsApp connection may break or lead to restrictions.
- Multi-file Baileys auth is for development only, not production-scale secret management.
- SQLite node module on Node 22 is experimental; evaluate PostgreSQL migration before public usage.
- Virtual reward farming possible until cooldown, fraud detection, caps and game balancing are built.
- Idempotent command processing alone does not guarantee exactly-once delivery to WhatsApp; add durable outbox/reconciliation.
- Self-hosted AI needs sufficient hardware, model evaluation, content safety and operating budget.

## Open decisions (do not block MVP)
- Target concurrent players and expected daily traffic.
- Preferred self-hosted hardware and budget.
- Whether multiplayer groups are authorized and how user consent will work.
- Exact subscription benefits and payment compliance.
- Game balancing, V-Currency reward/sink policy, moderation standards.
