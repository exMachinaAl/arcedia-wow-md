# WOW v3.4.0 — Interactive World / Chat Signatures

## Verified, unverified
Prior user report: mixed group button and its selector LIVE PASS; DM v3.3 status not provided; common-player chat decoration LIVE PASS; Delete on common-player source message LIVE FAIL. This patch never claims to fix deletion.

## DM interactive hubs
`.menu` includes choices for `.hub world|games|arena|economy|identity`.
Every hub uses three native quick replies and one single-select sheet (7–11 rows) with **real**, static allowlisted action IDs. Buttons route existing core commands. Transaction validation stays in `core.process`.

## Cosmetic V shop
`.chatstyle signature shop` / `buy spark|royal|guild` / `use spark|royal|guild` / `off`.
Prices 40 / 120 / 180 V. Buy once; item is tied to player's WOW user ID, never tradeable, never top-up, never redeemed for money. Atomic conditional debit prevents negative V. Purchase journal stores eventKey for auditing. Message content is not stored for sale.

## Safe chat
Mirror is safe default. Player consent and group/admin opt-in are still required; no badge necessary. Delete original messages continues to depend on genuine delivery acknowledgment, exact message key and verified bot-admin; FAIL/PENDING_LIVE for common players.

## Minimal live QA
1. DM as common player: `.menu` → `World` → check quests/mining response; then `Games` → Blackjack action.
2. DM `.chatstyle signature shop` / purchase and use Spark after obtaining at least 40 earned V. Verify wallet debits once and decorated group chat displays ✦; group chat content must remain safe.
3. Do not test Replace/Delete as release gate; bug remains open.
