# WOW v1.9 — Life & Virtual Economy

## Immutable economic policy
- No real-world money, top-ups, advertisements-for-credits, withdrawals, cash-outs, P2P V transfers, buying/selling with third parties or goods with monetary value.
- Legacy `.pay` commands are permanently disabled; transfer history stays read-only for audit. Database trigger blocks any new insert into legacy transfers.
- Legacy bound V from v1.7–v1.8 stays intact and remains spendable through `.wow shop`; no automatic conversion of pre-existing bound credits. **New** V slot and room rounds use the main V wallet.
- Odds do not depend on skill, ML, wallet balance or engagement. Local model forecasts only fictional price series.
- Virtual-chance mode requires user opt-in; one play costs 5 V; max 25 V spent/day, max 100 V wins/day. These caps do not constitute legal clearance for public release.

## Commands
`.wow economy` · `.vshop` · `.vshop buy focus-token` · `.vshop buy hint-scroll` · `.craft` · `.craft make copper-badge` · `.career choose artisan` · `.career shift` · `.collection wow` · `.wow audit` · `.market forecast NOVA`

Virtual arcade: `.arcade v enable` · `.arcade v disable` · `.slot v odds` · `.slot v` · `.risk v help` · `.risk v create` · `.risk v join CODE` · `.risk v choose CODE safe|balanced|legend` · `.risk v resolve CODE` · `.risk v cancel CODE` · `.risk v clean`.

## Lifecycle
Income is free: daily, mining, existing work, one chosen career shift/day, skill-based ranked rewards. Spending via shop/craft is a currency sink. Mining earns one material for each mining action; materials from before upgrade are claimed idempotently when `.craft` is used. Crafting costs both material and V. Purchased crafted collectibles are strictly account bound.

## Shutdown/recovery and record integrity
Core `process()` wraps mutations in SQLite `BEGIN IMMEDIATE` and stores the message event key to prevent retry credit/debits. Room state and deck RNG outcomes persist. Open paid risk rooms can be cancelled to refund and expired rooms refund on access or `.risk v clean`; schedule `.risk v clean` in an admin-maintenance job for inactive rooms. Backup database before update. Old legacy rows are never rewritten except transfer opt-in settings disabled.

## Compliance / risk
V is designed nonredeemable, but virtual-stake games still require a legal/platform policy review before public launch, especially on unofficial Baileys. The source is for controlled sandbox testing. Consider age restrictions, transparency, opt-out, fixed odds and loss limits.

## ML
`.market forecast NOVA|AQUA|ORBI` fits time-trend regression to the last 14 synthetic daily quotes, backtests seven past days against a last-price baseline and selects regression only if it beats baseline MAE. Does not use real market data or promise profitable forecasts.
