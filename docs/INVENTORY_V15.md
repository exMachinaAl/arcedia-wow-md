# WA-WORLD v1.5.0 Inventory & Item Engine — Technical Design

## Items & roles

| ID | Rarity | Type | Action | Acquisition |
|----|--------|------|--------|-------------|
| focus-token | COMMON | Consumable | +10 XP, 1 use/day WIB | Starter, daily scheduled claim |
| hint-scroll | UNCOMMON | Consumable | Reveals parity & half-range of active guess | Starter, daily scheduled claim |
| pioneer-badge | LEGENDARY | Cosmetic Badge | Profile badge only | Free, until 2026-12-31 WIB |
| jade-frame | RARE | Cosmetic Frame | Profile decoration only | At least 10 games played |
| veteran-title | EPIC | Cosmetic Title | Profile decoration only | At least 25 games played |

All items are account-bound, cannot be traded, redeemed for money, or wagered. Items never alter ranked outcomes. `Pioneer Badge` is time-gated rather than paid/exchanged; scarcity claims do not imply a transferable market value. Rarities are metadata for collection goals, not probabilities.

## Storage & integrity

- `item_stacks(user_id,item_id,quantity)`: per-account count; SQLite CHECK quantity 1–30, unique composite key.
- `item_equipment(user_id,slot,item_id)`: one equipped ID per cosmetic slot, linked to owned stack.
- `item_events(event_key,user_id,item_id,delta,reason,created_ms)`: audit journal, event key unique.
- Every command executes in existing `createCore.process()` transaction, uses `BEGIN IMMEDIATE` and deduplication through `processed_messages`.
- Restart behavior: tables and data persist in SQLite. Database must be backed up before installer writes source. No item tables included in ZIP.
- No direct price, deposit, transfer, store, cash-out, chance purchase, or cross-user equipment usage.

## Commands

`.inventory`, `.item help`, `.item list`, `.item info ID`, `.item claim starter`, `.item claim pioneer`, `.item claim milestones`, `.item daily`, `.item use focus-token`, `.item use hint-scroll`, `.item equip pioneer-badge`, `.item unequip badge`, `.collection`, `.item history`.

## QA gates

Offline: 165 existing tests + 17 new tests. Live WhatsApp: DM starter claim, inventory, badge claim, equip, profile. Group privacy and daily item tests optional. Test claims with two separate message IDs. Preserve source SHA verification and rollback.

## Future extensions (not implemented)

- Crafting recipes / item sinks with reversible item ledger entries
- Season-specific sets and collection reward achievements
- Permissioned item effect hooks with allowlist per PvE mode
- Analytics for item acquisition, retention and usage (no tracking private WA content)
- ML recommendations based only on consented pseudonymous aggregate behavior
